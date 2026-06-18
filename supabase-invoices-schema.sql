-- ================================================================
-- INVOICE FEATURE — DATABASE SCHEMA
-- Run in: Supabase → SQL Editor → New Query → Run All
-- Safe to run even if some objects already exist (uses IF NOT EXISTS)
-- ================================================================

-- ── EXTENSIONS ───────────────────────────────────────────────────
-- Needed for gen_random_bytes() used in public_token default below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fallback: ensure the shared updated_at trigger function exists
-- (it was created by an earlier migration, but this makes the script
-- safe to run standalone on a fresh database too)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ── SEQUENCE for auto invoice numbers, resets style per year in code ──
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ── INVOICES TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  BIGSERIAL PRIMARY KEY,
  invoice_number      TEXT        NOT NULL UNIQUE,
  order_id            TEXT,
  invoice_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  payment_status      TEXT        NOT NULL DEFAULT 'Unpaid'
                        CHECK (payment_status IN ('Paid','Unpaid','Partial','Refunded')),
  company_logo_url    TEXT,

  -- customer info
  customer_name       TEXT        NOT NULL DEFAULT '',
  customer_email      TEXT,
  customer_phone      TEXT,
  billing_address     TEXT        NOT NULL DEFAULT '',
  shipping_address    TEXT        NOT NULL DEFAULT '',

  -- pricing summary
  subtotal            NUMERIC     NOT NULL DEFAULT 0,
  shipping_charges    NUMERIC     NOT NULL DEFAULT 0,
  discount_amount     NUMERIC     NOT NULL DEFAULT 0,
  tax_amount          NUMERIC     NOT NULL DEFAULT 0,
  delivery_tax        NUMERIC     NOT NULL DEFAULT 0,
  grand_total         NUMERIC     NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'PKR',

  -- payment info
  payment_method      TEXT        CHECK (payment_method IN ('Card','Bank','COD','Wallet') OR payment_method IS NULL),
  transaction_id      TEXT,
  payment_date        DATE,
  amount_paid         NUMERIC     NOT NULL DEFAULT 0,

  -- shipping/courier
  courier_name        TEXT,
  tracking_number     TEXT,
  delivery_status     TEXT        CHECK (delivery_status IN ('Pending','Shipped','Out for Delivery','Delivered','Returned') OR delivery_status IS NULL),

  notes               TEXT,
  public_token        TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  created_by          UUID        REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_token  ON invoices(public_token);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_date   ON invoices(invoice_date DESC);

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── INVOICE ITEMS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id            BIGSERIAL PRIMARY KEY,
  invoice_id    BIGINT      NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id    BIGINT      REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT        NOT NULL DEFAULT '',
  sku           TEXT        NOT NULL DEFAULT '',
  quantity      NUMERIC     NOT NULL DEFAULT 1,
  unit_price    NUMERIC     NOT NULL DEFAULT 0,
  discount      NUMERIC     NOT NULL DEFAULT 0,
  tax_pct       NUMERIC     NOT NULL DEFAULT 0,
  line_total    NUMERIC     NOT NULL DEFAULT 0,
  sort_order    INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ── AUTO INVOICE NUMBER FUNCTION ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT := to_char(CURRENT_DATE, 'YYYY');
  next_num  INTEGER;
  result    TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN invoice_number LIKE 'INV-' || year_part || '-%'
    THEN (regexp_replace(invoice_number, '^INV-\d{4}-', ''))::INTEGER
    ELSE 0 END
  ), 0) + 1
  INTO next_num
  FROM invoices;

  result := 'INV-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth manage invoices"      ON invoices;
DROP POLICY IF EXISTS "Public read invoice by token" ON invoices;
DROP POLICY IF EXISTS "Auth manage invoice_items"  ON invoice_items;
DROP POLICY IF EXISTS "Public read invoice_items"  ON invoice_items;

-- Logged-in staff/admin can fully manage invoices
CREATE POLICY "Auth manage invoices" ON invoices
  FOR ALL USING (auth.role() = 'authenticated');

-- Anyone with the public_token link can VIEW (read-only) — used for "Share Link"
CREATE POLICY "Public read invoice by token" ON invoices
  FOR SELECT USING (true);

CREATE POLICY "Auth manage invoice_items" ON invoice_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read invoice_items" ON invoice_items
  FOR SELECT USING (true);

-- ── REALTIME (optional, lets the invoice list auto-refresh) ──────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Invoice schema ready' AS status;
