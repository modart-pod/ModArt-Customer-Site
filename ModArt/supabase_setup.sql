-- ================================================================
-- ModArt Complete Supabase Setup
-- Paste this entire file into Supabase SQL Editor and click Run
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ================================================================


-- ── 1. CORE TABLES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  series           TEXT,
  price_inr        INT NOT NULL DEFAULT 0,
  images           TEXT[] DEFAULT '{}',
  badge            TEXT,
  description      TEXT,
  fabric_gsm       TEXT,
  fabric_material  TEXT,
  fabric_origin    TEXT,
  fabric_shrinkage TEXT,
  fabric_finish    TEXT,
  print_durability TEXT,
  tags             TEXT[] DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT NOT NULL,
  stock       INT NOT NULL DEFAULT 0,
  reorder_at  INT NOT NULL DEFAULT 10,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, size)
);

CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT UNIQUE NOT NULL,
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email      TEXT,
  items            TEXT NOT NULL DEFAULT '[]',
  shipping_address TEXT NOT NULL DEFAULT '{}',
  subtotal_inr     INT NOT NULL DEFAULT 0,
  shipping_inr     INT NOT NULL DEFAULT 0,
  total_inr        INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
  payment_method   TEXT NOT NULL DEFAULT 'cod',
  payment_id       TEXT,
  tracking_number  TEXT,
  courier          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items      TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL DEFAULT 10,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses         INT,
  used_count       INT NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  drop_id    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, drop_id)
);


-- ── 2. ADD MISSING COLUMNS (safe on existing tables) ─────────────

ALTER TABLE orders    ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS courier         TEXT;
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS payment_id      TEXT;
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_at      INT DEFAULT 10;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();


-- ── 3. SEED DEFAULT COUPON ───────────────────────────────────────

INSERT INTO coupons (code, discount_percent, is_active)
VALUES ('MODART10', 10, TRUE)
ON CONFLICT (code) DO NOTHING;


-- ── 4. ATOMIC STOCK DECREMENT RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION decrement_stock(
  p_product_id TEXT,
  p_size       TEXT,
  p_quantity   INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  SELECT stock INTO current_stock
  FROM inventory
  WHERE product_id = p_product_id AND size = p_size
  FOR UPDATE;

  IF current_stock IS NULL OR current_stock < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE inventory
  SET stock = stock - p_quantity, updated_at = NOW()
  WHERE product_id = p_product_id AND size = p_size;

  RETURN TRUE;
END;
$$;


-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts on re-run
DROP POLICY IF EXISTS "products_read"        ON products;
DROP POLICY IF EXISTS "inventory_read"       ON inventory;
DROP POLICY IF EXISTS "orders_user_read"     ON orders;
DROP POLICY IF EXISTS "orders_user_insert"   ON orders;
DROP POLICY IF EXISTS "orders_user_update"   ON orders;
DROP POLICY IF EXISTS "carts_user_all"       ON carts;
DROP POLICY IF EXISTS "coupons_read"         ON coupons;
DROP POLICY IF EXISTS "waitlist_insert"      ON waitlist;

-- Products: anyone can read active products
CREATE POLICY "products_read" ON products
  FOR SELECT USING (is_active = TRUE);

-- Inventory: anyone can read stock levels
CREATE POLICY "inventory_read" ON inventory
  FOR SELECT USING (TRUE);

-- Orders: users see only their own orders; guests can insert
CREATE POLICY "orders_user_read" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "orders_user_insert" ON orders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

CREATE POLICY "orders_user_update" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Carts: users can only access their own cart
CREATE POLICY "carts_user_all" ON carts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coupons: anyone can read active codes (validation is server-side)
CREATE POLICY "coupons_read" ON coupons
  FOR SELECT USING (is_active = TRUE);

-- Waitlist: anyone can sign up
CREATE POLICY "waitlist_insert" ON waitlist
  FOR INSERT WITH CHECK (TRUE);
