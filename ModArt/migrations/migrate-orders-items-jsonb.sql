-- ================================================================
-- Migration: orders.items TEXT → JSONB
-- Run in Supabase SQL Editor (one time).
-- Validates all existing rows before altering the column type.
-- ================================================================

-- Step 1: Verify all existing rows have valid JSON before migrating
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM orders
  WHERE items IS NOT NULL
    AND items != '[]'
    AND items::jsonb IS NULL;  -- will throw if invalid JSON exists

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Found % rows with invalid JSON in orders.items — fix before migrating', bad_count;
  END IF;

  RAISE NOTICE 'All rows validated — safe to migrate';
END;
$$;

-- Step 2: Add a new JSONB column alongside the existing TEXT column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_jsonb JSONB;

-- Step 3: Copy and cast all existing data
UPDATE orders
SET items_jsonb = items::jsonb
WHERE items IS NOT NULL;

-- Step 4: Set a default and NOT NULL constraint on the new column
ALTER TABLE orders ALTER COLUMN items_jsonb SET DEFAULT '[]'::jsonb;
UPDATE orders SET items_jsonb = '[]'::jsonb WHERE items_jsonb IS NULL;
ALTER TABLE orders ALTER COLUMN items_jsonb SET NOT NULL;

-- Step 5: Drop the old TEXT column and rename
ALTER TABLE orders DROP COLUMN items;
ALTER TABLE orders RENAME COLUMN items_jsonb TO items;

-- Step 6: Add a GIN index for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON orders USING GIN (items);

-- Step 7: Update all RPCs that reference items as TEXT to use JSONB
-- The create_order_idempotent and rollback_order_stock RPCs use items::jsonb
-- internally already — they will work without changes since JSONB casts cleanly.

COMMENT ON COLUMN orders.items IS 'JSONB array of order line items. Migrated from TEXT on ' || NOW()::DATE;
