-- ================================================================
-- ModArt Complete Enhanced Supabase Setup
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
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE SET NULL,
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

-- NEW: Track per-user coupon usage to prevent abuse
CREATE TABLE IF NOT EXISTS coupon_uses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id  UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_guest CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
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

CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items      TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS drops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  drop_number  INT,
  status       TEXT NOT NULL DEFAULT 'upcoming',
  cover_color  TEXT DEFAULT '#1A1A1A',
  product_ids  TEXT[] DEFAULT '{}',
  total_units  INT NOT NULL DEFAULT 100,
  sold_units   INT NOT NULL DEFAULT 0,
  price_inr    INT NOT NULL DEFAULT 0,
  launch_at    TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. PERFORMANCE INDEXES ───────────────────────────────────────

-- Orders indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Inventory index for product lookups
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

-- Waitlist index for drop queries
CREATE INDEX IF NOT EXISTS idx_waitlist_drop_id ON waitlist(drop_id);

-- Products index for tag searches
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);

-- Coupon uses index for user lookups
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user_id ON coupon_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon_id ON coupon_uses(coupon_id);

-- ── 3. SEED PRODUCTS WITH IMAGES ─────────────────────────────────

INSERT INTO products (id, name, series, price_inr, images, badge, description, fabric_gsm, fabric_material, fabric_origin, fabric_shrinkage, fabric_finish, print_durability, tags, is_active)
VALUES
  ('vanta-tee', 'Vanta Black Tee', 'Modart Studio', 9999, 
   ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'],
   'New', 'A clean, structured tee built from 220 GSM ring-spun cotton. Minimal by design, maximum in quality.',
   '220 GSM', '100% Ring-Spun Cotton', 'India', '<2%', 'Matte', '50+ Washes',
   ARRAY['tee', 'minimal', 'cotton', 'black'], TRUE),
   
  ('elfima-hoodie', 'Elfima Hoodie', 'Craftsmanship', 18199,
   ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800', 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800'],
   'Low Stock', 'Heavyweight hoodie with a structured silhouette. Brushed fleece interior for warmth without bulk.',
   '380 GSM', '80% Cotton 20% Polyester', 'Portugal', '<3%', 'Brushed', '50+ Washes',
   ARRAY['hoodie', 'heavyweight', 'fleece', 'winter'], TRUE),
   
  ('cargo-pants', 'Grid Cargo Pants', 'Industrial Line', 14599,
   ARRAY['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800', 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800'],
   NULL, 'Utility-forward cargo pants with a relaxed fit. Reinforced seams and deep pockets built for everyday wear.',
   '280 GSM', '100% Cotton Twill', 'India', '<2%', 'Washed', '60+ Washes',
   ARRAY['pants', 'cargo', 'utility', 'cotton'], TRUE),
   
  ('vanta-hoodie', 'Vanta Black Hoodie', 'Vanta Collection', 19999,
   ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800', 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'],
   'Drop 02', 'Engineered for the modern minimalist. Oversized silhouette crafted from rare high-density Supima cotton.',
   '400 GSM', '100% Supima Cotton', 'Portugal', '<2%', 'Matte', '50+ Washes',
   ARRAY['hoodie', 'premium', 'supima', 'oversized', 'black'], TRUE),
   
  ('knit-sweater', 'Boxy Knit Sweater', 'Essential Knit', 15399,
   ARRAY['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800'],
   NULL, 'A relaxed boxy knit with a dropped shoulder. Made from a premium cotton-wool blend for year-round wear.',
   '320 GSM', '70% Cotton 30% Wool', 'Portugal', '<3%', 'Natural', '40+ Washes',
   ARRAY['sweater', 'knit', 'wool', 'boxy'], TRUE),
   
  ('neo-tee', 'Neo-Tokyo Tee', 'Cyber Core', 7899,
   ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800'],
   'Sold Out', 'Inspired by the neon-lit streets of Tokyo. Lightweight and breathable with a subtle texture weave.',
   '200 GSM', '100% Combed Cotton', 'India', '<2%', 'Smooth', '50+ Washes',
   ARRAY['tee', 'lightweight', 'cotton', 'graphic'], FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── 4. SEED INVENTORY ────────────────────────────────────────────

INSERT INTO inventory (product_id, size, stock) VALUES
  ('vanta-tee',     'XS', 2), ('vanta-tee',     'S',  3), ('vanta-tee',     'M',  5), ('vanta-tee',     'L',  4), ('vanta-tee',     'XL', 2), ('vanta-tee',     'XXL',1),
  ('elfima-hoodie', 'XS', 1), ('elfima-hoodie', 'S',  1), ('elfima-hoodie', 'M',  3), ('elfima-hoodie', 'L',  2), ('elfima-hoodie', 'XL', 1), ('elfima-hoodie', 'XXL',0),
  ('cargo-pants',   'XS', 2), ('cargo-pants',   'S',  3), ('cargo-pants',   'M',  4), ('cargo-pants',   'L',  3), ('cargo-pants',   'XL', 2), ('cargo-pants',   'XXL',1),
  ('vanta-hoodie',  'XS', 2), ('vanta-hoodie',  'S',  3), ('vanta-hoodie',  'M',  7), ('vanta-hoodie',  'L',  5), ('vanta-hoodie',  'XL', 3), ('vanta-hoodie',  'XXL',2),
  ('knit-sweater',  'XS', 3), ('knit-sweater',  'S',  4), ('knit-sweater',  'M',  5), ('knit-sweater',  'L',  4), ('knit-sweater',  'XL', 3), ('knit-sweater',  'XXL',2),
  ('neo-tee',       'XS', 0), ('neo-tee',       'S',  0), ('neo-tee',       'M',  0), ('neo-tee',       'L',  0), ('neo-tee',       'XL', 0), ('neo-tee',       'XXL',0)
ON CONFLICT (product_id, size) DO NOTHING;

-- ── 5. SEED COUPONS ──────────────────────────────────────────────

INSERT INTO coupons (code, discount_percent, is_active, max_uses)
VALUES
  ('MODART10', 10, TRUE, NULL),
  ('LAUNCH20', 20, TRUE, 100),
  ('WELCOME15', 15, TRUE, 500)
ON CONFLICT (code) DO NOTHING;

-- ── 6. SEED DROPS ────────────────────────────────────────────────

INSERT INTO drops (name, drop_number, status, cover_color, total_units, sold_units, price_inr, description, launch_at, end_at, is_active)
VALUES
  ('Void Edition',  8, 'live',     '#1A1A1A', 120, 88, 19999, 'Engineered for the void. 120 GSM heavyweight oversized silhouette.',
   NOW() - INTERVAL '1 day', NOW() + INTERVAL '18 hours', TRUE),
  ('Origin Series', 9, 'upcoming', '#0F0F0F', 150, 0,  22999, 'Where it all began. The original ModArt silhouette, remastered.',
   NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days', TRUE),
  ('Chrome Core',   7, 'ended',    '#111111', 100, 100, 17999, 'Sold out in 4h 12m. The fastest sellout in ModArt history.',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', TRUE)
ON CONFLICT DO NOTHING;

-- ── 7. ATOMIC STOCK DECREMENT RPC ────────────────────────────────

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

-- ── 8. INCREMENT COUPON USAGE RPC ────────────────────────────────

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

-- ── 9. NEW: INCREMENT DROP SOLD UNITS RPC ────────────────────────

CREATE OR REPLACE FUNCTION increment_drop_sold_units(
  p_drop_id UUID,
  p_quantity INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_sold INT;
  current_total INT;
BEGIN
  SELECT sold_units, total_units INTO current_sold, current_total
  FROM drops
  WHERE id = p_drop_id
  FOR UPDATE;
  
  IF current_sold IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF (current_sold + p_quantity) > current_total THEN
    RETURN FALSE;
  END IF;
  
  UPDATE drops
  SET sold_units = sold_units + p_quantity, updated_at = NOW()
  WHERE id = p_drop_id;
  
  RETURN TRUE;
END;
$$;

-- ── 10. ANALYTICS: REVENUE STATS RPC ─────────────────────────────

CREATE OR REPLACE FUNCTION get_revenue_stats(since_ts TIMESTAMPTZ)
RETURNS TABLE(total_revenue BIGINT, order_count BIGINT, avg_order NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(total_inr), 0)::BIGINT AS total_revenue,
    COUNT(*)::BIGINT                     AS order_count,
    COALESCE(ROUND(AVG(total_inr), 0), 0) AS avg_order
  FROM orders
  WHERE created_at >= since_ts AND status NOT IN ('cancelled');
$$;

-- ── 11. ANALYTICS: ORDER STATUS COUNTS RPC ───────────────────────

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

-- ── 12. NEW: ANALYTICS: TOP PRODUCTS RPC ─────────────────────────

CREATE OR REPLACE FUNCTION get_top_products(limit_count INT DEFAULT 10)
RETURNS TABLE(
  product_id TEXT,
  product_name TEXT,
  total_quantity BIGINT,
  total_revenue BIGINT,
  order_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS product_id,
    p.name AS product_name,
    SUM((item->>'quantity')::INT)::BIGINT AS total_quantity,
    SUM((item->>'quantity')::INT * (item->>'price')::INT)::BIGINT AS total_revenue,
    COUNT(DISTINCT o.id)::BIGINT AS order_count
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) AS item
  JOIN products p ON p.id = (item->>'productId')
  WHERE o.status NOT IN ('cancelled')
  GROUP BY p.id, p.name
  ORDER BY total_revenue DESC
  LIMIT limit_count;
END;
$$;

-- ── 13. AUTO updated_at TRIGGER ──────────────────────────────────

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
DROP TRIGGER IF EXISTS trg_drops_updated_at     ON drops;

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

CREATE TRIGGER trg_drops_updated_at
  BEFORE UPDATE ON drops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 14. ADMIN ROLE HELPER ────────────────────────────────────────

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

-- ── 15. ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops        ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "products_read"      ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "inventory_read"     ON inventory;
DROP POLICY IF EXISTS "inventory_admin_all" ON inventory;
DROP POLICY IF EXISTS "orders_user_read"   ON orders;
DROP POLICY IF EXISTS "orders_user_insert" ON orders;
DROP POLICY IF EXISTS "orders_user_update" ON orders;
DROP POLICY IF EXISTS "orders_guest_insert" ON orders;
DROP POLICY IF EXISTS "orders_admin_all"   ON orders;
DROP POLICY IF EXISTS "carts_user_all"     ON carts;
DROP POLICY IF EXISTS "carts_admin_read"   ON carts;
DROP POLICY IF EXISTS "coupons_read"       ON coupons;
DROP POLICY IF EXISTS "coupons_admin_all"  ON coupons;
DROP POLICY IF EXISTS "coupon_uses_read"   ON coupon_uses;
DROP POLICY IF EXISTS "coupon_uses_insert" ON coupon_uses;
DROP POLICY IF EXISTS "coupon_uses_admin_all" ON coupon_uses;
DROP POLICY IF EXISTS "waitlist_insert"    ON waitlist;
DROP POLICY IF EXISTS "waitlist_admin_all" ON waitlist;
DROP POLICY IF EXISTS "wishlists_user_all" ON wishlists;
DROP POLICY IF EXISTS "wishlists_admin_read" ON wishlists;
DROP POLICY IF EXISTS "drops_read"         ON drops;
DROP POLICY IF EXISTS "drops_admin_all"    ON drops;

-- Products policies
CREATE POLICY "products_read"      ON products  FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "products_admin_all" ON products  FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- Inventory policies
CREATE POLICY "inventory_read"     ON inventory FOR SELECT USING (TRUE);
CREATE POLICY "inventory_admin_all" ON inventory FOR ALL   USING (is_admin()) WITH CHECK (is_admin());

-- Orders policies
CREATE POLICY "orders_user_read"   ON orders    FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "orders_user_insert" ON orders    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_guest_insert" ON orders   FOR INSERT WITH CHECK (user_id IS NULL);
CREATE POLICY "orders_user_update" ON orders    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
CREATE POLICY "orders_admin_all"   ON orders    FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- Carts policies
CREATE POLICY "carts_user_all"     ON carts     FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "carts_admin_read"   ON carts     FOR SELECT USING (is_admin());

-- Coupons policies
CREATE POLICY "coupons_read"       ON coupons   FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "coupons_admin_all"  ON coupons   FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- Coupon uses policies (NEW)
CREATE POLICY "coupon_uses_read"   ON coupon_uses FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "coupon_uses_insert" ON coupon_uses FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "coupon_uses_admin_all" ON coupon_uses FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Waitlist policies
CREATE POLICY "waitlist_insert"    ON waitlist  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "waitlist_admin_all" ON waitlist  FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- Wishlists policies
CREATE POLICY "wishlists_user_all" ON wishlists FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlists_admin_read" ON wishlists FOR SELECT USING (is_admin());

-- Drops policies
CREATE POLICY "drops_read"         ON drops     FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "drops_admin_all"    ON drops     FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ── 16. ENABLE SUPABASE REALTIME ─────────────────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE drops;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE coupons;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE coupon_uses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ================================================================
-- SETUP COMPLETE ✓
-- ================================================================
-- 
-- What's included:
-- ✓ 9 tables: products, inventory, orders, carts, coupons, coupon_uses, 
--   waitlist, wishlists, drops
-- ✓ 10 performance indexes for fast queries
-- ✓ 7 RPCs: decrement_stock, increment_coupon_usage, 
--   increment_drop_sold_units, get_revenue_stats, 
--   get_order_status_counts, get_top_products, is_admin
-- ✓ Complete RLS policies for all tables
-- ✓ Auto updated_at triggers
-- ✓ Seed data: 6 products with images, 36 inventory SKUs, 
--   3 coupons, 3 drops
-- ✓ Realtime subscriptions enabled
--
-- Next steps:
-- 1. Update your Supabase environment variables in Vercel
-- 2. Test admin login with: modart.pod@gmail.com
-- 3. Verify realtime sync between admin and customer pages
-- ================================================================
