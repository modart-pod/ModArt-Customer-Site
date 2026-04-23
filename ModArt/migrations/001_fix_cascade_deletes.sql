-- ================================================================
-- Migration: Fix CASCADE Deletes to Preserve Order History
-- Date: 2025-06-28
-- Issue: C-9 - Product deletion breaks order history
-- ================================================================

-- ✅ FIX #1: Change inventory foreign key from CASCADE to SET NULL
-- This prevents inventory records from being deleted when a product is deleted
-- Allows historical inventory data to be preserved

ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_product_id_fkey,
ADD CONSTRAINT inventory_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE SET NULL;

-- Note: product_id column needs to allow NULL for this to work
-- If it doesn't, we need to alter the column first
DO $$
BEGIN
  -- Check if column allows NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory'
    AND column_name = 'product_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Make column nullable
    ALTER TABLE inventory ALTER COLUMN product_id DROP NOT NULL;
    RAISE NOTICE 'Made inventory.product_id nullable';
  END IF;
END $$;

-- ✅ FIX #2: Add soft delete to products table
-- Instead of hard deleting products, mark them as deleted
-- This preserves all historical references

ALTER TABLE products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at)
WHERE deleted_at IS NULL;

-- ✅ FIX #3: Create safe product deletion function
-- Use this instead of DELETE to soft-delete products

CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET 
    deleted_at = NOW(),
    is_active = FALSE,
    updated_at = NOW()
  WHERE id = p_product_id
  AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- ✅ FIX #4: Update products_read policy to exclude deleted products

DROP POLICY IF EXISTS "products_read" ON products;

CREATE POLICY "products_read" ON products
FOR SELECT
USING (
  (is_active = TRUE AND deleted_at IS NULL)
  OR is_admin()
);

-- ✅ FIX #5: Add function to restore deleted products (admin only)

CREATE OR REPLACE FUNCTION restore_product(p_product_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can restore products';
  END IF;
  
  UPDATE products
  SET 
    deleted_at = NULL,
    is_active = TRUE,
    updated_at = NOW()
  WHERE id = p_product_id
  AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$;

-- ================================================================
-- MIGRATION COMPLETE ✓
-- ================================================================
--
-- Changes made:
-- ✓ inventory.product_id foreign key changed from CASCADE to SET NULL
-- ✓ inventory.product_id made nullable
-- ✓ products.deleted_at column added for soft deletes
-- ✓ soft_delete_product() function created
-- ✓ restore_product() function created
-- ✓ products_read policy updated to exclude deleted products
--
-- Usage:
-- - To delete a product: SELECT soft_delete_product('product-id');
-- - To restore a product: SELECT restore_product('product-id');
-- - Deleted products are hidden from customers but visible to admins
-- - Order history is preserved even after product deletion
--
-- ================================================================
