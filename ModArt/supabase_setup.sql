-- ================================================================
-- ModArt Complete Supabase Setup
-- Paste this entire file into Supabase SQL Editor and click Run
-- ================================================================

-- ── 1. CREATE ALL TABLES ─────────────────────────────────────────

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
  discount_inr     INT NOT NULL DEFAULT 0,
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
  name       TEXT,
  drop_id    TEXT,
  notified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, drop_id)
);

-- ── 2. SEED PRODUCTS ─────────────────────────────────────────────

INSERT INTO products (id, name, series, price_inr, badge, description, fabric_gsm, fabric_material, fabric_origin, fabric_shrinkage, fabric_finish, print_durability, is_active)
VALUES
  ('vanta-tee',     'Vanta Black Tee',    'Modart Studio',    9999,  'New',       'A clean, structured tee built from 220 GSM ring-spun cotton. Minimal by design, maximum in quality.',                '220 GSM', '100% Ring-Spun Cotton',       'India',    '<2%', 'Matte',  '50+ Washes', TRUE),
  ('elfima-hoodie', 'Elfima Hoodie',       'Craftsmanship',   18199, 'Low Stock', 'Heavyweight hoodie with a structured silhouette. Brushed fleece interior for warmth without bulk.',                  '380 GSM', '80% Cotton 20% Polyester',    'Portugal', '<3%', 'Brushed','50+ Washes', TRUE),
  ('cargo-pants',   'Grid Cargo Pants',    'Industrial Line', 14599, NULL,        'Utility-forward cargo pants with a relaxed fit. Reinforced seams and deep pockets built for everyday wear.',         '280 GSM', '100% Cotton Twill',           'India',    '<2%', 'Washed', '60+ Washes', TRUE),
  ('vanta-hoodie',  'Vanta Black Hoodie',  'Vanta Collection',19999, 'Drop 02',   'Engineered for the modern minimalist. Oversized silhouette crafted from rare high-density Supima cotton.',           '400 GSM', '100% Supima Cotton',          'Portugal', '<2%', 'Matte',  '50+ Washes', TRUE),
  ('knit-sweater',  'Boxy Knit Sweater',   'Essential Knit',  15399, NULL,        'A relaxed boxy knit with a dropped shoulder. Made from a premium cotton-wool blend for year-round wear.',            '320 GSM', '70% Cotton 30% Wool',         'Portugal', '<3%', 'Natural','40+ Washes', TRUE),
  ('neo-tee',       'Neo-Tokyo Tee',       'Cyber Core',       7899, 'Sold Out',  'Inspired by the neon-lit streets of Tokyo. Lightweight and breathable with a subtle texture weave.',                 '200 GSM', '100% Combed Cotton',          'India',    '<2%', 'Smooth', '50+ Washes', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── 3. SEED INVENTORY ────────────────────────────────────────────

INSERT INTO inventory (product_id, size, stock) VALUES
  ('vanta-tee',     'XS', 2), ('vanta-tee',     'S',  3), ('vanta-tee',     'M',  5), ('vanta-tee',     'L',  4), ('vanta-tee',     'XL', 2), ('vanta-tee',     'XXL',1),
  ('elfima-hoodie', 'XS', 1), ('elfima-hoodie', 'S',  1), ('elfima-hoodie', 'M',  3), ('elfima-hoodie', 'L',  2), ('elfima-hoodie', 'XL', 1), ('elfima-hoodie', 'XXL',0),
  ('cargo-pants',   'XS', 2), ('cargo-pants',   'S',  3), ('cargo-pants',   'M',  4), ('cargo-pants',   'L',  3), ('cargo-pants',   'XL', 2), ('cargo-pants',   'XXL',1),
  ('vanta-hoodie',  'XS', 2), ('vanta-hoodie',  'S',  3), ('vanta-hoodie',  'M',  7), ('vanta-hoodie',  'L',  5), ('vanta-hoodie',  'XL', 3), ('vanta-hoodie',  'XXL',2),
  ('knit-sweater',  'XS', 3), ('knit-sweater',  'S',  4), ('knit-sweater',  'M',  5), ('knit-sweater',  'L',  4), ('knit-sweater',  'XL', 3), ('knit-sweater',  'XXL',2),
  ('neo-tee',       'XS', 0), ('neo-tee',       'S',  0), ('neo-tee',       'M',  0), ('neo-tee',       'L',  0), ('neo-tee',       'XL', 0), ('neo-tee',       'XXL',0)
ON CONFLICT (product_id, size) DO NOTHING;

-- ── 4. SEED COUPONS ──────────────────────────────────────────────

INSERT INTO coupons (code, discount_percent, is_active)
VALUES
  ('MODART10', 10, TRUE),
  ('LAUNCH20', 20, TRUE),
  ('WELCOME15', 15, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ── 5. ATOMIC STOCK DECREMENT RPC ────────────────────────────────

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

-- ── 6. AUTO updated_at TRIGGER ───────────────────────────────────
-- Automatically keeps updated_at in sync on every row update.
-- Prevents stale timestamps when JS forgets to set updated_at.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at  ON products;
DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS trg_orders_updated_at    ON orders;
DROP TRIGGER IF EXISTS trg_carts_updated_at     ON carts;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. ADMIN ROLE HELPER ─────────────────────────────────────────
-- Returns TRUE when the calling JWT belongs to the admin email.
-- Used in RLS policies so the admin can bypass user-scoped rules.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') = 'modart.pod@gmail.com',
    FALSE
  );
$$;

-- ── 8. ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist  ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies cleanly before recreating
DROP POLICY IF EXISTS "products_read"           ON products;
DROP POLICY IF EXISTS "products_admin_all"       ON products;
DROP POLICY IF EXISTS "inventory_read"           ON inventory;
DROP POLICY IF EXISTS "inventory_admin_all"      ON inventory;
DROP POLICY IF EXISTS "orders_user_read"         ON orders;
DROP POLICY IF EXISTS "orders_user_insert"       ON orders;
DROP POLICY IF EXISTS "orders_user_update"       ON orders;
DROP POLICY IF EXISTS "orders_guest_insert"      ON orders;
DROP POLICY IF EXISTS "orders_admin_all"         ON orders;
DROP POLICY IF EXISTS "carts_user_all"           ON carts;
DROP POLICY IF EXISTS "carts_admin_read"         ON carts;
DROP POLICY IF EXISTS "coupons_read"             ON coupons;
DROP POLICY IF EXISTS "coupons_admin_all"        ON coupons;
DROP POLICY IF EXISTS "waitlist_insert"          ON waitlist;
DROP POLICY IF EXISTS "waitlist_admin_all"       ON waitlist;

-- ── PRODUCTS ─────────────────────────────────────────────────────
-- Public: read active products only
CREATE POLICY "products_read"
  ON products FOR SELECT
  USING (is_active = TRUE OR is_admin());

-- Admin: full CRUD
CREATE POLICY "products_admin_all"
  ON products FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── INVENTORY ────────────────────────────────────────────────────
-- Public: read all inventory (needed for stock display)
CREATE POLICY "inventory_read"
  ON inventory FOR SELECT
  USING (TRUE);

-- Admin: full CRUD (update stock, add sizes)
CREATE POLICY "inventory_admin_all"
  ON inventory FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── ORDERS ───────────────────────────────────────────────────────
-- Logged-in users: read their own orders
CREATE POLICY "orders_user_read"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- Logged-in users: insert their own orders
CREATE POLICY "orders_user_insert"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Guest checkout: insert orders with no user_id
CREATE POLICY "orders_guest_insert"
  ON orders FOR INSERT
  WITH CHECK (user_id IS NULL);

-- Logged-in users: update their own orders (e.g. cancel)
CREATE POLICY "orders_user_update"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin: full access to all orders (read, update status, tracking, etc.)
CREATE POLICY "orders_admin_all"
  ON orders FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── CARTS ────────────────────────────────────────────────────────
-- Users: full access to their own cart
CREATE POLICY "carts_user_all"
  ON carts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: read all carts (for analytics)
CREATE POLICY "carts_admin_read"
  ON carts FOR SELECT
  USING (is_admin());

-- ── COUPONS ──────────────────────────────────────────────────────
-- Public: read active coupons (needed for validate-coupon fallback)
CREATE POLICY "coupons_read"
  ON coupons FOR SELECT
  USING (is_active = TRUE OR is_admin());

-- Admin: full CRUD (create, deactivate, edit coupons)
CREATE POLICY "coupons_admin_all"
  ON coupons FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── WAITLIST ─────────────────────────────────────────────────────
-- Anyone: join the waitlist
CREATE POLICY "waitlist_insert"
  ON waitlist FOR INSERT
  WITH CHECK (TRUE);

-- Admin: read and manage all waitlist entries
CREATE POLICY "waitlist_admin_all"
  ON waitlist FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── 9. ANALYTICS HELPER RPCs ─────────────────────────────────────
-- Used by admin dashboard to get revenue and order stats efficiently.

-- Returns total revenue and order count for a given time window.
CREATE OR REPLACE FUNCTION get_revenue_stats(since_ts TIMESTAMPTZ)
RETURNS TABLE(
  total_revenue BIGINT,
  order_count   BIGINT,
  avg_order     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(total_inr), 0)::BIGINT                          AS total_revenue,
    COUNT(*)::BIGINT                                              AS order_count,
    COALESCE(ROUND(AVG(total_inr), 0), 0)                        AS avg_order
  FROM orders
  WHERE created_at >= since_ts
    AND status NOT IN ('cancelled');
$$;

-- Returns order counts grouped by status.
CREATE OR REPLACE FUNCTION get_order_status_counts()
RETURNS TABLE(status TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT status, COUNT(*)::BIGINT AS cnt
  FROM orders
  GROUP BY status;
$$;

-- ── 10. INCREMENT COUPON USAGE RPC ───────────────────────────────
-- Called after a coupon is successfully applied at checkout.

CREATE OR REPLACE FUNCTION increment_coupon_usage(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE code = p_code AND is_active = TRUE;
END;
$$;
