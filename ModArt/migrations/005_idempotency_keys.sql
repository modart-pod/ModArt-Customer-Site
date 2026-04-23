-- ================================================================
-- Migration 005: Idempotency Keys for Order Prevention
-- ================================================================
-- 
-- DATA INTEGRITY FIX: H-1 - Duplicate order prevention
-- 
-- This migration adds:
-- 1. idempotency_key column to orders table
-- 2. Unique constraint on idempotency_key
-- 3. create_order_idempotent() RPC function
-- 4. Index for fast idempotency key lookups
-- 
-- Run this in Supabase SQL Editor after 004_atomic_coupon_usage.sql
-- ================================================================

-- ── 1. ADD IDEMPOTENCY KEY COLUMN ────────────────────────────────

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index (allows NULL values, but enforces uniqueness when present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key 
  ON orders(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key_created 
  ON orders(idempotency_key, created_at) 
  WHERE idempotency_key IS NOT NULL;

-- ── 2. IDEMPOTENT ORDER CREATION FUNCTION ────────────────────────

CREATE OR REPLACE FUNCTION create_order_idempotent(
  p_idempotency_key TEXT,
  p_order_number    TEXT,
  p_user_id         UUID,
  p_guest_email     TEXT,
  p_items           TEXT,
  p_shipping_address TEXT,
  p_subtotal_inr    INT,
  p_discount_inr    INT,
  p_shipping_inr    INT,
  p_total_inr       INT,
  p_payment_method  TEXT DEFAULT 'cod'
)
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  is_duplicate BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_order RECORD;
  v_new_order_id UUID;
BEGIN
  -- Check if order with this idempotency key already exists
  SELECT id, order_number, created_at INTO v_existing_order
  FROM orders
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  
  -- If order exists, return it (idempotent behavior)
  IF v_existing_order.id IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_existing_order.id,
      v_existing_order.order_number,
      TRUE AS is_duplicate,
      v_existing_order.created_at;
    RETURN;
  END IF;
  
  -- Create new order
  INSERT INTO orders (
    idempotency_key,
    order_number,
    user_id,
    guest_email,
    items,
    shipping_address,
    subtotal_inr,
    discount_inr,
    shipping_inr,
    total_inr,
    status,
    payment_method,
    created_at,
    updated_at
  ) VALUES (
    p_idempotency_key,
    p_order_number,
    p_user_id,
    p_guest_email,
    p_items,
    p_shipping_address,
    p_subtotal_inr,
    p_discount_inr,
    p_shipping_inr,
    p_total_inr,
    'pending',
    p_payment_method,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_order_id;
  
  -- Return new order
  RETURN QUERY SELECT 
    v_new_order_id,
    p_order_number,
    FALSE AS is_duplicate,
    NOW() AS created_at;
END;
$$;

-- ── 3. GET ORDER BY IDEMPOTENCY KEY ──────────────────────────────

CREATE OR REPLACE FUNCTION get_order_by_idempotency_key(p_key TEXT)
RETURNS TABLE(
  id UUID,
  order_number TEXT,
  status TEXT,
  total_inr INT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, order_number, status, total_inr, created_at
  FROM orders
  WHERE idempotency_key = p_key
  LIMIT 1;
$$;

-- ── 4. CLEANUP OLD IDEMPOTENCY KEYS ──────────────────────────────
-- Optional: Clean up idempotency keys older than 24 hours
-- This prevents the table from growing indefinitely

CREATE OR REPLACE FUNCTION cleanup_old_idempotency_keys()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Only clean up keys for completed/cancelled orders older than 24 hours
  UPDATE orders
  SET idempotency_key = NULL
  WHERE idempotency_key IS NOT NULL
    AND created_at < NOW() - INTERVAL '24 hours'
    AND status IN ('delivered', 'cancelled', 'failed');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- ── 5. ADD CONSTRAINT TO PREVENT EMPTY KEYS ──────────────────────

ALTER TABLE orders
ADD CONSTRAINT orders_idempotency_key_not_empty
CHECK (idempotency_key IS NULL OR length(idempotency_key) >= 16);

-- ── 6. UPDATE RLS POLICIES ───────────────────────────────────────
-- No changes needed - existing policies cover idempotency_key column

-- ================================================================
-- MIGRATION 005 COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ idempotency_key column on orders table
-- ✓ Unique constraint on idempotency_key
-- ✓ create_order_idempotent() RPC function
-- ✓ get_order_by_idempotency_key() helper
-- ✓ cleanup_old_idempotency_keys() maintenance function
-- ✓ Indexes for fast lookups
-- ✓ Constraint to prevent empty keys
-- 
-- Next steps:
-- 1. Update js/orders.js to generate idempotency keys
-- 2. Use create_order_idempotent() RPC for order creation
-- 3. Store key in sessionStorage for retry logic
-- 4. Test duplicate order submission
-- 
-- Optional: Set up cron job to cleanup old keys
-- SELECT cron.schedule(
--   'cleanup-idempotency-keys',
--   '0 2 * * *',  -- Daily at 2 AM
--   'SELECT cleanup_old_idempotency_keys();'
-- );
-- ================================================================
