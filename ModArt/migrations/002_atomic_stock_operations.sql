-- ================================================================
-- Migration 002: Atomic Stock Operations
-- ================================================================
-- 
-- SECURITY FIX: C-4 - Race condition in stock decrement
-- 
-- This migration adds:
-- 1. Enhanced decrement_stock RPC with row-level locking
-- 2. Inventory transaction log for audit trail
-- 3. Stock rollback function for failed orders
-- 
-- Run this in Supabase SQL Editor after 001_fix_cascade_deletes.sql
-- ================================================================

-- ── 1. CREATE INVENTORY TRANSACTION LOG ──────────────────────────

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    TEXT NOT NULL,
  size          TEXT NOT NULL,
  quantity      INT NOT NULL,
  operation     TEXT NOT NULL CHECK (operation IN ('decrement', 'increment', 'rollback')),
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  reason        TEXT,
  stock_before  INT NOT NULL,
  stock_after   INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast order lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id 
  ON inventory_transactions(order_id);

-- Index for product audit trail
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product 
  ON inventory_transactions(product_id, size, created_at DESC);

-- ── 2. ENHANCED ATOMIC STOCK DECREMENT RPC ───────────────────────

CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id TEXT,
  p_size       TEXT,
  p_quantity   INT,
  p_order_id   UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INT;
  v_new_stock     INT;
BEGIN
  -- Lock the row to prevent concurrent modifications
  SELECT stock INTO v_current_stock
  FROM inventory
  WHERE product_id = p_product_id AND size = p_size
  FOR UPDATE;
  
  -- Check if stock exists and is sufficient
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product % size % not found in inventory', p_product_id, p_size;
  END IF;
  
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for % size %. Available: %, Requested: %', 
      p_product_id, p_size, v_current_stock, p_quantity;
  END IF;
  
  -- Calculate new stock
  v_new_stock := v_current_stock - p_quantity;
  
  -- Update inventory
  UPDATE inventory
  SET stock = v_new_stock, updated_at = NOW()
  WHERE product_id = p_product_id AND size = p_size;
  
  -- Log transaction
  INSERT INTO inventory_transactions (
    product_id, size, quantity, operation, order_id, 
    stock_before, stock_after, reason
  ) VALUES (
    p_product_id, p_size, p_quantity, 'decrement', p_order_id,
    v_current_stock, v_new_stock, 'Order placement'
  );
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log failed attempt
    INSERT INTO inventory_transactions (
      product_id, size, quantity, operation, order_id,
      stock_before, stock_after, reason
    ) VALUES (
      p_product_id, p_size, p_quantity, 'decrement', p_order_id,
      COALESCE(v_current_stock, 0), COALESCE(v_current_stock, 0), 
      'FAILED: ' || SQLERRM
    );
    
    RETURN FALSE;
END;
$$;

-- ── 3. STOCK ROLLBACK FUNCTION ───────────────────────────────────

CREATE OR REPLACE FUNCTION rollback_stock(
  p_product_id TEXT,
  p_size       TEXT,
  p_quantity   INT,
  p_order_id   UUID DEFAULT NULL,
  p_reason     TEXT DEFAULT 'Order cancelled'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INT;
  v_new_stock     INT;
BEGIN
  -- Lock the row
  SELECT stock INTO v_current_stock
  FROM inventory
  WHERE product_id = p_product_id AND size = p_size
  FOR UPDATE;
  
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product % size % not found in inventory', p_product_id, p_size;
  END IF;
  
  -- Calculate new stock
  v_new_stock := v_current_stock + p_quantity;
  
  -- Update inventory
  UPDATE inventory
  SET stock = v_new_stock, updated_at = NOW()
  WHERE product_id = p_product_id AND size = p_size;
  
  -- Log transaction
  INSERT INTO inventory_transactions (
    product_id, size, quantity, operation, order_id,
    stock_before, stock_after, reason
  ) VALUES (
    p_product_id, p_size, p_quantity, 'rollback', p_order_id,
    v_current_stock, v_new_stock, p_reason
  );
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ── 4. BULK ROLLBACK FOR FAILED ORDERS ───────────────────────────

CREATE OR REPLACE FUNCTION rollback_order_stock(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'Order failed'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_items JSONB;
  v_item        JSONB;
  v_success     BOOLEAN := TRUE;
BEGIN
  -- Get order items
  SELECT items::JSONB INTO v_order_items
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order_items IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  
  -- Rollback each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order_items)
  LOOP
    v_success := rollback_stock(
      v_item->>'productId',
      v_item->>'size',
      (v_item->>'qty')::INT,
      p_order_id,
      p_reason
    );
    
    IF NOT v_success THEN
      RAISE WARNING 'Failed to rollback stock for product % size %', 
        v_item->>'productId', v_item->>'size';
    END IF;
  END LOOP;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ── 5. GET AVAILABLE STOCK (REAL-TIME) ───────────────────────────

CREATE OR REPLACE FUNCTION get_available_stock(
  p_product_id TEXT,
  p_size       TEXT
)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(stock, 0)
  FROM inventory
  WHERE product_id = p_product_id AND size = p_size;
$$;

-- ── 6. ENABLE RLS ON TRANSACTION LOG ─────────────────────────────

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Admin can see all transactions
CREATE POLICY "inventory_transactions_admin_all" 
  ON inventory_transactions 
  FOR ALL 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- Users can see their own order transactions
CREATE POLICY "inventory_transactions_user_read" 
  ON inventory_transactions 
  FOR SELECT 
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );

-- ── 7. ENABLE REALTIME FOR TRANSACTION LOG ───────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ================================================================
-- MIGRATION 002 COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ inventory_transactions table with audit trail
-- ✓ Enhanced decrement_stock() with row-level locking
-- ✓ rollback_stock() for individual items
-- ✓ rollback_order_stock() for bulk rollback
-- ✓ get_available_stock() for real-time checks
-- ✓ RLS policies for transaction log
-- ✓ Realtime enabled for transaction log
-- 
-- Next steps:
-- 1. Update js/products.js to use enhanced RPC
-- 2. Update js/orders.js to add rollback logic
-- 3. Test concurrent stock operations
-- ================================================================
