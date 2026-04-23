-- ================================================================
-- Migration 006: Optimistic Locking
-- ================================================================
-- 
-- DATA INTEGRITY FIX: H-11 - Optimistic locking for concurrent updates
-- 
-- This migration adds:
-- 1. version column to products, orders, inventory, coupons tables
-- 2. Auto-increment version trigger
-- 3. update_with_version() RPC functions
-- 4. Conflict detection and resolution
-- 
-- Run this in Supabase SQL Editor after 005_idempotency_keys.sql
-- ================================================================

-- ── 1. ADD VERSION COLUMNS ───────────────────────────────────────

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE drops 
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Create indexes for version checks
CREATE INDEX IF NOT EXISTS idx_products_version ON products(id, version);
CREATE INDEX IF NOT EXISTS idx_orders_version ON orders(id, version);
CREATE INDEX IF NOT EXISTS idx_inventory_version ON inventory(id, version);
CREATE INDEX IF NOT EXISTS idx_coupons_version ON coupons(id, version);
CREATE INDEX IF NOT EXISTS idx_drops_version ON drops(id, version);

-- ── 2. AUTO-INCREMENT VERSION TRIGGER ────────────────────────────

CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_products_version ON products;
DROP TRIGGER IF EXISTS trg_orders_version ON orders;
DROP TRIGGER IF EXISTS trg_inventory_version ON inventory;
DROP TRIGGER IF EXISTS trg_coupons_version ON coupons;
DROP TRIGGER IF EXISTS trg_drops_version ON drops;

-- Create version increment triggers
CREATE TRIGGER trg_products_version
  BEFORE UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.version IS NOT NULL)
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_orders_version
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.version IS NOT NULL)
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_inventory_version
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  WHEN (OLD.version IS NOT NULL)
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_coupons_version
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  WHEN (OLD.version IS NOT NULL)
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER trg_drops_version
  BEFORE UPDATE ON drops
  FOR EACH ROW
  WHEN (OLD.version IS NOT NULL)
  EXECUTE FUNCTION increment_version();

-- ── 3. UPDATE PRODUCT WITH VERSION CHECK ─────────────────────────

CREATE OR REPLACE FUNCTION update_product_with_version(
  p_id              TEXT,
  p_expected_version INT,
  p_name            TEXT DEFAULT NULL,
  p_price_inr       INT DEFAULT NULL,
  p_description     TEXT DEFAULT NULL,
  p_is_active       BOOLEAN DEFAULT NULL,
  p_images          TEXT[] DEFAULT NULL,
  p_tags            TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_version INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version INT;
  v_new_version INT;
BEGIN
  -- Lock row and get current version
  SELECT version INTO v_current_version
  FROM products
  WHERE id = p_id
  FOR UPDATE;
  
  -- Check if product exists
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found';
    RETURN;
  END IF;
  
  -- Check version match
  IF v_current_version != p_expected_version THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_current_version, 
      'Version conflict: expected ' || p_expected_version || ' but current is ' || v_current_version;
    RETURN;
  END IF;
  
  -- Update product (trigger will increment version)
  UPDATE products
  SET
    name = COALESCE(p_name, name),
    price_inr = COALESCE(p_price_inr, price_inr),
    description = COALESCE(p_description, description),
    is_active = COALESCE(p_is_active, is_active),
    images = COALESCE(p_images, images),
    tags = COALESCE(p_tags, tags)
  WHERE id = p_id
  RETURNING version INTO v_new_version;
  
  RETURN QUERY SELECT TRUE, v_new_version, 'Product updated successfully';
END;
$$;

-- ── 4. UPDATE INVENTORY WITH VERSION CHECK ───────────────────────

CREATE OR REPLACE FUNCTION update_inventory_with_version(
  p_id              UUID,
  p_expected_version INT,
  p_stock           INT DEFAULT NULL,
  p_reorder_at      INT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_version INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version INT;
  v_new_version INT;
BEGIN
  -- Lock row and get current version
  SELECT version INTO v_current_version
  FROM inventory
  WHERE id = p_id
  FOR UPDATE;
  
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Inventory record not found';
    RETURN;
  END IF;
  
  IF v_current_version != p_expected_version THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_current_version, 
      'Version conflict: expected ' || p_expected_version || ' but current is ' || v_current_version;
    RETURN;
  END IF;
  
  UPDATE inventory
  SET
    stock = COALESCE(p_stock, stock),
    reorder_at = COALESCE(p_reorder_at, reorder_at)
  WHERE id = p_id
  RETURNING version INTO v_new_version;
  
  RETURN QUERY SELECT TRUE, v_new_version, 'Inventory updated successfully';
END;
$$;

-- ── 5. UPDATE ORDER WITH VERSION CHECK ───────────────────────────

CREATE OR REPLACE FUNCTION update_order_with_version(
  p_id              UUID,
  p_expected_version INT,
  p_status          TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_courier         TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_version INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version INT;
  v_new_version INT;
BEGIN
  SELECT version INTO v_current_version
  FROM orders
  WHERE id = p_id
  FOR UPDATE;
  
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Order not found';
    RETURN;
  END IF;
  
  IF v_current_version != p_expected_version THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_current_version, 
      'Version conflict: expected ' || p_expected_version || ' but current is ' || v_current_version;
    RETURN;
  END IF;
  
  UPDATE orders
  SET
    status = COALESCE(p_status, status),
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    courier = COALESCE(p_courier, courier)
  WHERE id = p_id
  RETURNING version INTO v_new_version;
  
  RETURN QUERY SELECT TRUE, v_new_version, 'Order updated successfully';
END;
$$;

-- ── 6. UPDATE COUPON WITH VERSION CHECK ──────────────────────────

CREATE OR REPLACE FUNCTION update_coupon_with_version(
  p_id              UUID,
  p_expected_version INT,
  p_discount_percent INT DEFAULT NULL,
  p_is_active       BOOLEAN DEFAULT NULL,
  p_max_uses        INT DEFAULT NULL,
  p_expires_at      TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_version INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_version INT;
  v_new_version INT;
BEGIN
  SELECT version INTO v_current_version
  FROM coupons
  WHERE id = p_id
  FOR UPDATE;
  
  IF v_current_version IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Coupon not found';
    RETURN;
  END IF;
  
  IF v_current_version != p_expected_version THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_current_version, 
      'Version conflict: expected ' || p_expected_version || ' but current is ' || v_current_version;
    RETURN;
  END IF;
  
  UPDATE coupons
  SET
    discount_percent = COALESCE(p_discount_percent, discount_percent),
    is_active = COALESCE(p_is_active, is_active),
    max_uses = COALESCE(p_max_uses, max_uses),
    expires_at = COALESCE(p_expires_at, expires_at)
  WHERE id = p_id
  RETURNING version INTO v_new_version;
  
  RETURN QUERY SELECT TRUE, v_new_version, 'Coupon updated successfully';
END;
$$;

-- ── 7. GET CURRENT VERSION ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_product_version(p_id TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT version FROM products WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION get_order_version(p_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT version FROM orders WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION get_inventory_version(p_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT version FROM inventory WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION get_coupon_version(p_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT version FROM coupons WHERE id = p_id;
$$;

-- ================================================================
-- MIGRATION 006 COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ version column on products, orders, inventory, coupons, drops
-- ✓ Auto-increment version trigger
-- ✓ update_*_with_version() RPC functions
-- ✓ Conflict detection (returns current version on mismatch)
-- ✓ get_*_version() helper functions
-- ✓ Indexes for fast version checks
-- 
-- Next steps:
-- 1. Update admin panel to include version in edit forms
-- 2. Use update_*_with_version() RPCs for all updates
-- 3. Show conflict resolution UI when version mismatch
-- 4. Test concurrent updates from multiple admins
-- 
-- Usage example:
-- SELECT * FROM update_product_with_version(
--   'vanta-tee',
--   1,  -- expected version
--   'Updated Name',
--   9999,
--   NULL,
--   TRUE,
--   NULL,
--   NULL
-- );
-- 
-- Returns:
-- success | new_version | message
-- --------+-------------+-------------------------
-- true    | 2           | Product updated successfully
-- 
-- Or on conflict:
-- success | new_version | message
-- --------+-------------+-------------------------
-- false   | 3           | Version conflict: expected 1 but current is 3
-- ================================================================
