-- =====================================================
-- MIGRATION — fixes "deleted products come back" + adds
-- per-product alert bell + store_url for image fallback
-- Run in: Supabase → SQL Editor → New Query → Run
-- =====================================================

-- 1) Track manually-deleted products so sync never restores them
CREATE TABLE IF NOT EXISTS deleted_products (
  woo_id      INTEGER PRIMARY KEY,
  name        TEXT,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deleted_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth manage deleted_products" ON deleted_products;
CREATE POLICY "Auth manage deleted_products" ON deleted_products
  FOR ALL USING (auth.role() = 'authenticated');

-- 2) Per-product alert toggle (the "bell")
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3) Live store product page link — lets the app show/open the real
--    product image and page even when WooCommerce sync had no image
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS store_url TEXT;

-- 4) Never let a sync silently null-out an existing image_url.
--    (Enforced in application code too — see app/api/sync/route.ts)

SELECT 'Migration complete' AS status;
