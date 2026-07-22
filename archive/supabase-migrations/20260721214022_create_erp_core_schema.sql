/*
# Poligrafiya ERP – asosiy sxema

Poligrafiya kompaniyasi uchun CRM/ERP ma'lumotlar bazasi.
Bir kompaniya ichida ishlaydigan (single-tenant) tizim bo'lganligi
uchun RLS yoqilgan va anon+authenticated rollarga to'liq CRUD
ruxsat berilgan.

## 1. Yangi jadvallar
- `customers` – mijozlar
  - `id`, `first_name`, `last_name`, `phone`, `extra_phone`,
    `telegram`, `company`, `position`, `address`, `note`, `created_at`
- `brands` – bir mijozga tegishli brendlar
  - `id`, `customer_id`, `name`, `logo_url`, `note`, `created_at`
- `orders` – buyurtmalar
  - `id`, `brand_id`, `customer_id`, `title`, `description`,
    `status`, `total_amount`, `paid_amount`, `telegram_link`,
    `manager_name`, `deadline`, `completed_at`, `created_at`
- `order_files` – buyurtma fayllari (havolalar)
  - `id`, `order_id`, `filename`, `url`, `mime_type`, `size`, `created_at`
- `products` – tijorat taklifi va katalog uchun mahsulotlar
  - `id`, `name`, `unit`, `base_price`, `category`, `created_at`
- `proposals` – tijorat takliflari
  - `id`, `number`, `customer_id`, `brand_id`, `title`, `items` (jsonb),
    `subtotal`, `discount`, `total`, `valid_until`, `note`, `created_at`
- `company_settings` – kompaniya rekvizitlari (yagona qator)
- `holidays` – bayram/dam olish kunlari
- `monthly_plans` – oy bo'yicha reja
- `managers` – sotuv menejerlari va ularning rejasi

## 2. Xavfsizlik
- Har bir jadvalda RLS yoqilgan
- CRUD ruxsatlari `anon` va `authenticated` rollarga ochiq
  (single-tenant ERP, ichki foydalanish uchun)

## 3. Muhim eslatmalar
1. Fayllar tashqi URL (yoki Supabase Storage havolasi) sifatida saqlanadi.
2. `company_settings` yagona qatordir; `singleton` boolean orqali cheklanadi.
3. `proposals.items` jsonb massiv sifatida saqlanadi.
*/

-- ============================================================
-- Customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text DEFAULT '',
  phone text DEFAULT '',
  extra_phone text DEFAULT '',
  telegram text DEFAULT '',
  company text DEFAULT '',
  position text DEFAULT '',
  address text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Brands
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_customer_id_idx ON brands(customer_id);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select" ON brands;
CREATE POLICY "brands_select" ON brands FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "brands_insert" ON brands;
CREATE POLICY "brands_insert" ON brands FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "brands_update" ON brands;
CREATE POLICY "brands_update" ON brands FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "brands_delete" ON brands;
CREATE POLICY "brands_delete" ON brands FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  telegram_link text DEFAULT '',
  manager_name text DEFAULT '',
  deadline date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_brand_id_idx ON orders(brand_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Order files
-- ============================================================
CREATE TABLE IF NOT EXISTS order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  mime_type text DEFAULT '',
  size bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_files_order_id_idx ON order_files(order_id);

ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_files_select" ON order_files;
CREATE POLICY "order_files_select" ON order_files FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "order_files_insert" ON order_files;
CREATE POLICY "order_files_insert" ON order_files FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "order_files_update" ON order_files;
CREATE POLICY "order_files_update" ON order_files FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "order_files_delete" ON order_files;
CREATE POLICY "order_files_delete" ON order_files FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Products (tijorat taklifi uchun katalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'dona',
  base_price numeric(14,2) NOT NULL DEFAULT 0,
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Proposals (tijorat takliflari)
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  valid_until date,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposals_customer_id_idx ON proposals(customer_id);
CREATE INDEX IF NOT EXISTS proposals_created_at_idx ON proposals(created_at DESC);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals_select" ON proposals;
CREATE POLICY "proposals_select" ON proposals FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "proposals_insert" ON proposals;
CREATE POLICY "proposals_insert" ON proposals FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "proposals_update" ON proposals;
CREATE POLICY "proposals_update" ON proposals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "proposals_delete" ON proposals;
CREATE POLICY "proposals_delete" ON proposals FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Company settings (yagona qator)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  name text DEFAULT '',
  logo_url text DEFAULT '',
  director_name text DEFAULT '',
  phone text DEFAULT '',
  extra_phone text DEFAULT '',
  email text DEFAULT '',
  telegram text DEFAULT '',
  website text DEFAULT '',
  address text DEFAULT '',
  stir text DEFAULT '',
  mfo text DEFAULT '',
  bank_account text DEFAULT '',
  bank_name text DEFAULT '',
  qr_url text DEFAULT '',
  work_hours text DEFAULT '',
  google_maps text DEFAULT '',
  instagram text DEFAULT '',
  facebook text DEFAULT '',
  youtube text DEFAULT '',
  requisites text DEFAULT '',
  stamp_url text DEFAULT '',
  signature_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "company_settings_delete" ON company_settings;
CREATE POLICY "company_settings_delete" ON company_settings FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO company_settings (singleton, name)
VALUES (true, 'Poligrafiya')
ON CONFLICT (singleton) DO NOTHING;

-- ============================================================
-- Holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "holidays_select" ON holidays;
CREATE POLICY "holidays_select" ON holidays FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "holidays_insert" ON holidays;
CREATE POLICY "holidays_insert" ON holidays FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "holidays_update" ON holidays;
CREATE POLICY "holidays_update" ON holidays FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "holidays_delete" ON holidays;
CREATE POLICY "holidays_delete" ON holidays FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Monthly plans
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  plan_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (year, month)
);

ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_plans_select" ON monthly_plans;
CREATE POLICY "monthly_plans_select" ON monthly_plans FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "monthly_plans_insert" ON monthly_plans;
CREATE POLICY "monthly_plans_insert" ON monthly_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "monthly_plans_update" ON monthly_plans;
CREATE POLICY "monthly_plans_update" ON monthly_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "monthly_plans_delete" ON monthly_plans;
CREATE POLICY "monthly_plans_delete" ON monthly_plans FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Managers
-- ============================================================
CREATE TABLE IF NOT EXISTS managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  monthly_plan numeric(14,2) NOT NULL DEFAULT 0,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers_select" ON managers;
CREATE POLICY "managers_select" ON managers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "managers_insert" ON managers;
CREATE POLICY "managers_insert" ON managers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "managers_update" ON managers;
CREATE POLICY "managers_update" ON managers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "managers_delete" ON managers;
CREATE POLICY "managers_delete" ON managers FOR DELETE
  TO anon, authenticated USING (true);
