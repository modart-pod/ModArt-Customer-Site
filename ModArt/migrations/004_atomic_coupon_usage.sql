-- ================================================================
-- Migration 004: Atomic Coupon Usage
-- ================================================================
-- 
-- SECURITY FIX: C-8 - Coupon usage not atomic
-- 
-- This migration adds:
-- 1. used_count column to coupons table (if not exists)
-- 2. increment_coupon_usage() RPC with row-level locking
-- 3. check_coupon_availability() RPC for validation
-- 4. Per-user coupon usage tracking (already exists in main setup)
-- 
-- Run this in Supabase SQL Editor after 003_inventory_reservations.sql
-- ================================================================

-- ── 1. ADD used_count COLUMN (IF NOT EXISTS) ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coupons' AND column_name = 'used_count'
  ) THEN
    ALTER TABLE coupons ADD COLUMN used_count INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 2. ATOMIC INCREMENT COUPON USAGE ─────────────────────────────

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon_id UUID;
  v_max_uses INT;
  v_used_count INT;
BEGIN
  -- Lock the coupon row to prevent race conditions
  SELECT id, max_uses, used_count 
  INTO v_coupon_id, v_max_uses, v_used_count
  FROM coupons
  WHERE code = p_code AND is_active = TRUE
  FOR UPDATE;
  
  IF v_coupon_id IS NULL THEN
    RAISE EXCEPTION 'Coupon % not found or inactive', p_code;
  END IF;
  
  -- Check if max uses exceeded
  IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
    RAISE EXCEPTION 'Coupon % has reached maximum usage limit', p_code;
  END IF;
  
  -- Increment usage count
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = v_coupon_id;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ── 3. CHECK COUPON AVAILABILITY ─────────────────────────────────

CREATE OR REPLACE FUNCTION check_coupon_availability(
  p_code TEXT,
  p_user_id UUID DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL
)
RETURNS TABLE(
  available BOOLEAN,
  discount_percent INT,
  reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_coupon RECORD;
  v_user_usage_count INT;
BEGIN
  -- Get coupon details
  SELECT * INTO v_coupon
  FROM coupons
  WHERE code = p_code;
  
  -- Check if coupon exists
  IF v_coupon.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Coupon not found';
    RETURN;
  END IF;
  
  -- Check if active
  IF NOT v_coupon.is_active THEN
    RETURN QUERY SELECT FALSE, 0, 'Coupon is inactive';
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN QUERY SELECT FALSE, 0, 'Coupon has expired';
    RETURN;
  END IF;
  
  -- Check global usage limit
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT FALSE, 0, 'Coupon usage limit reached';
    RETURN;
  END IF;
  
  -- Check per-user usage (if user is logged in or guest email provided)
  IF p_user_id IS NOT NULL OR p_guest_email IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_usage_count
    FROM coupon_uses
    WHERE coupon_id = v_coupon.id
      AND (
        (p_user_id IS NOT NULL AND user_id = p_user_id) OR
        (p_guest_email IS NOT NULL AND guest_email = p_guest_email)
      );
    
    -- Limit to 1 use per user/email (can be adjusted)
    IF v_user_usage_count > 0 THEN
      RETURN QUERY SELECT FALSE, 0, 'You have already used this coupon';
      RETURN;
    END IF;
  END IF;
  
  -- Coupon is available
  RETURN QUERY SELECT TRUE, v_coupon.discount_percent, 'Coupon is valid';
END;
$$;

-- ── 4. GET COUPON USAGE STATS ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_coupon_stats(p_code TEXT)
RETURNS TABLE(
  code TEXT,
  discount_percent INT,
  is_active BOOLEAN,
  max_uses INT,
  used_count INT,
  remaining_uses INT,
  expires_at TIMESTAMPTZ,
  unique_users BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    c.code,
    c.discount_percent,
    c.is_active,
    c.max_uses,
    c.used_count,
    CASE 
      WHEN c.max_uses IS NULL THEN NULL
      ELSE GREATEST(0, c.max_uses - c.used_count)
    END AS remaining_uses,
    c.expires_at,
    COUNT(DISTINCT COALESCE(cu.user_id::TEXT, cu.guest_email)) AS unique_users
  FROM coupons c
  LEFT JOIN coupon_uses cu ON cu.coupon_id = c.id
  WHERE c.code = p_code
  GROUP BY c.id, c.code, c.discount_percent, c.is_active, c.max_uses, c.used_count, c.expires_at;
$$;

-- ── 5. ROLLBACK COUPON USAGE (FOR FAILED ORDERS) ────────────────

CREATE OR REPLACE FUNCTION rollback_coupon_usage(
  p_code TEXT,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon_id UUID;
BEGIN
  -- Get coupon ID
  SELECT id INTO v_coupon_id
  FROM coupons
  WHERE code = p_code
  FOR UPDATE;
  
  IF v_coupon_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Decrement usage count
  UPDATE coupons
  SET used_count = GREATEST(0, used_count - 1)
  WHERE id = v_coupon_id;
  
  -- Delete coupon_uses record
  DELETE FROM coupon_uses
  WHERE coupon_id = v_coupon_id AND order_id = p_order_id;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ── 6. CREATE INDEX FOR COUPON USAGE LOOKUPS ─────────────────────

CREATE INDEX IF NOT EXISTS idx_coupon_uses_lookup 
  ON coupon_uses(coupon_id, user_id, guest_email);

-- ── 7. ADD CONSTRAINT TO PREVENT NEGATIVE USAGE ──────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'coupons_used_count_positive'
  ) THEN
    ALTER TABLE coupons 
    ADD CONSTRAINT coupons_used_count_positive 
    CHECK (used_count >= 0);
  END IF;
END $$;

-- ================================================================
-- MIGRATION 004 COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ used_count column on coupons table
-- ✓ increment_coupon_usage() with row-level locking
-- ✓ check_coupon_availability() for validation
-- ✓ get_coupon_stats() for admin analytics
-- ✓ rollback_coupon_usage() for failed orders
-- ✓ Index for fast coupon usage lookups
-- ✓ Constraint to prevent negative usage counts
-- 
-- Next steps:
-- 1. Update api/validate-coupon.js to use check_coupon_availability()
-- 2. Update js/orders.js to use increment_coupon_usage()
-- 3. Add rollback logic for failed orders
-- 4. Test concurrent coupon usage
-- ================================================================
