-- ================================================================
-- Migration 003: Inventory Reservation System
-- ================================================================
-- 
-- SECURITY FIX: C-7 - No inventory reservation during checkout
-- 
-- This migration adds:
-- 1. inventory_reservations table
-- 2. reserve_inventory() RPC function
-- 3. release_reservations() RPC function
-- 4. get_available_stock() with reservation awareness
-- 5. Auto-cleanup of expired reservations
-- 
-- Run this in Supabase SQL Editor after 002_atomic_stock_operations.sql
-- ================================================================

-- ── 1. CREATE INVENTORY RESERVATIONS TABLE ───────────────────────

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    TEXT NOT NULL,
  size          TEXT NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  session_id    TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released      BOOLEAN NOT NULL DEFAULT FALSE,
  released_at   TIMESTAMPTZ,
  release_reason TEXT
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reservations_session 
  ON inventory_reservations(session_id) WHERE released = FALSE;

CREATE INDEX IF NOT EXISTS idx_reservations_product 
  ON inventory_reservations(product_id, size) WHERE released = FALSE;

CREATE INDEX IF NOT EXISTS idx_reservations_expires 
  ON inventory_reservations(expires_at) WHERE released = FALSE;

CREATE INDEX IF NOT EXISTS idx_reservations_user 
  ON inventory_reservations(user_id) WHERE released = FALSE;

-- ── 2. RESERVE INVENTORY FUNCTION ────────────────────────────────

CREATE OR REPLACE FUNCTION reserve_inventory(
  p_product_id TEXT,
  p_size       TEXT,
  p_quantity   INT,
  p_session_id TEXT,
  p_user_id    UUID DEFAULT NULL,
  p_duration_minutes INT DEFAULT 10
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INT;
  v_reserved_stock INT;
  v_available_stock INT;
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiry time
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Lock the inventory row
  SELECT stock INTO v_current_stock
  FROM inventory
  WHERE product_id = p_product_id AND size = p_size
  FOR UPDATE;
  
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product % size % not found in inventory', p_product_id, p_size;
  END IF;
  
  -- Calculate currently reserved stock (excluding expired)
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
  FROM inventory_reservations
  WHERE product_id = p_product_id 
    AND size = p_size 
    AND released = FALSE
    AND expires_at > NOW();
  
  -- Calculate available stock
  v_available_stock := v_current_stock - v_reserved_stock;
  
  IF v_available_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock for % size %. Available: %, Requested: %', 
      p_product_id, p_size, v_available_stock, p_quantity;
  END IF;
  
  -- Release any existing reservations for this session
  UPDATE inventory_reservations
  SET released = TRUE, 
      released_at = NOW(), 
      release_reason = 'Replaced by new reservation'
  WHERE session_id = p_session_id 
    AND product_id = p_product_id 
    AND size = p_size
    AND released = FALSE;
  
  -- Create new reservation
  INSERT INTO inventory_reservations (
    product_id, size, quantity, session_id, user_id, expires_at
  ) VALUES (
    p_product_id, p_size, p_quantity, p_session_id, p_user_id, v_expires_at
  )
  RETURNING id INTO v_reservation_id;
  
  RETURN v_reservation_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Reservation failed: %', SQLERRM;
END;
$$;

-- ── 3. RELEASE RESERVATIONS FUNCTION ─────────────────────────────

CREATE OR REPLACE FUNCTION release_reservations(
  p_session_id TEXT,
  p_reason     TEXT DEFAULT 'User action'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE inventory_reservations
  SET released = TRUE,
      released_at = NOW(),
      release_reason = p_reason
  WHERE session_id = p_session_id
    AND released = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- ── 4. RELEASE SPECIFIC RESERVATION ──────────────────────────────

CREATE OR REPLACE FUNCTION release_reservation(
  p_reservation_id UUID,
  p_reason         TEXT DEFAULT 'User action'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory_reservations
  SET released = TRUE,
      released_at = NOW(),
      release_reason = p_reason
  WHERE id = p_reservation_id
    AND released = FALSE;
  
  RETURN FOUND;
END;
$$;

-- ── 5. GET AVAILABLE STOCK (WITH RESERVATIONS) ───────────────────

CREATE OR REPLACE FUNCTION get_available_stock(
  p_product_id TEXT,
  p_size       TEXT
)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT GREATEST(0, 
    COALESCE(i.stock, 0) - COALESCE(
      (SELECT SUM(quantity) 
       FROM inventory_reservations 
       WHERE product_id = p_product_id 
         AND size = p_size 
         AND released = FALSE 
         AND expires_at > NOW()), 
      0
    )
  )
  FROM inventory i
  WHERE i.product_id = p_product_id AND i.size = p_size;
$$;

-- ── 6. EXTEND RESERVATION EXPIRY ─────────────────────────────────

CREATE OR REPLACE FUNCTION extend_reservation(
  p_reservation_id UUID,
  p_additional_minutes INT DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory_reservations
  SET expires_at = expires_at + (p_additional_minutes || ' minutes')::INTERVAL
  WHERE id = p_reservation_id
    AND released = FALSE
    AND expires_at > NOW();
  
  RETURN FOUND;
END;
$$;

-- ── 7. GET SESSION RESERVATIONS ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_session_reservations(p_session_id TEXT)
RETURNS TABLE(
  id UUID,
  product_id TEXT,
  size TEXT,
  quantity INT,
  expires_at TIMESTAMPTZ,
  seconds_remaining INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    id,
    product_id,
    size,
    quantity,
    expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM (expires_at - NOW()))::INT) AS seconds_remaining
  FROM inventory_reservations
  WHERE session_id = p_session_id
    AND released = FALSE
    AND expires_at > NOW()
  ORDER BY expires_at ASC;
$$;

-- ── 8. AUTO-CLEANUP EXPIRED RESERVATIONS ─────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE inventory_reservations
  SET released = TRUE,
      released_at = NOW(),
      release_reason = 'Expired'
  WHERE released = FALSE
    AND expires_at <= NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- ── 9. ENABLE RLS ON RESERVATIONS ────────────────────────────────

ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

-- Admin can see all reservations
CREATE POLICY "reservations_admin_all" 
  ON inventory_reservations 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Users can see their own reservations
CREATE POLICY "reservations_user_read" 
  ON inventory_reservations 
  FOR SELECT 
  USING (user_id = auth.uid() OR is_admin());

-- Anyone can create reservations (session-based)
CREATE POLICY "reservations_insert" 
  ON inventory_reservations 
  FOR INSERT 
  WITH CHECK (TRUE);

-- ── 10. ENABLE REALTIME FOR RESERVATIONS ─────────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_reservations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 11. CREATE CLEANUP CRON JOB (OPTIONAL) ───────────────────────
-- 
-- If you have pg_cron extension enabled, uncomment this to auto-cleanup
-- expired reservations every minute:
-- 
-- SELECT cron.schedule(
--   'cleanup-expired-reservations',
--   '* * * * *',
--   'SELECT cleanup_expired_reservations();'
-- );

-- ================================================================
-- MIGRATION 003 COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ inventory_reservations table
-- ✓ reserve_inventory() - Creates reservation with expiry
-- ✓ release_reservations() - Releases all session reservations
-- ✓ release_reservation() - Releases specific reservation
-- ✓ get_available_stock() - Returns stock minus active reservations
-- ✓ extend_reservation() - Extends reservation expiry
-- ✓ get_session_reservations() - Gets active reservations for session
-- ✓ cleanup_expired_reservations() - Auto-cleanup function
-- ✓ RLS policies for reservations
-- ✓ Realtime enabled for reservations
-- 
-- Next steps:
-- 1. Create js/inventory-reservation.js module
-- 2. Integrate with checkout flow
-- 3. Add countdown timer UI
-- 4. Add auto-release on page leave
-- 5. Test reservation expiry and cleanup
-- ================================================================
