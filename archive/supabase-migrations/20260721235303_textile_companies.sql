/*
# Textile companies management

Adds a dedicated table for the polygraphy shop's external textile production
partners, plus reference columns on orders. Company name is looked up live from
this table but a snapshot is also stored on each order so historical documents
never break when a company is later renamed.

1. New Tables
- `textile_companies`
- `id` (uuid, primary key)
- `company_number` (text, unique — auto-assigned TXT-001, TXT-002…)
- `name` (text, not null)
- `contact_person` (text)
- `phone` (text)
- `telegram` (text)
- `address` (text)
- `note` (text)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now())
2. Modified Tables
- `orders`
- `textile_company_id` (uuid, nullable, references `textile_companies(id)` on delete set null)
- `textile_company_name` (text, nullable — historical snapshot of the name at
save time so old orders remain readable if the company is later renamed)
3. Indexes
- `idx_textile_companies_name` — search by name
- `idx_orders_textile_company_id` — company detail queries
4. Security
- RLS enabled on `textile_companies` with anon+authenticated CRUD (single-tenant
shared data model consistent with the rest of the app).
*/

CREATE TABLE IF NOT EXISTS textile_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_number text UNIQUE,
  name text NOT NULL,
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  telegram text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE textile_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "textile_companies_select" ON textile_companies;
CREATE POLICY "textile_companies_select" ON textile_companies FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "textile_companies_insert" ON textile_companies;
CREATE POLICY "textile_companies_insert" ON textile_companies FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "textile_companies_update" ON textile_companies;
CREATE POLICY "textile_companies_update" ON textile_companies FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "textile_companies_delete" ON textile_companies;
CREATE POLICY "textile_companies_delete" ON textile_companies FOR DELETE
TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'textile_company_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN textile_company_id uuid
      REFERENCES textile_companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'textile_company_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN textile_company_name text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_textile_companies_name ON textile_companies(name);
CREATE INDEX IF NOT EXISTS idx_orders_textile_company_id ON orders(textile_company_id);
