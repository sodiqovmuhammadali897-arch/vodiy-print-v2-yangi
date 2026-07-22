/*
# Order wizard uchun kengaytirilgan sxema

Mavjud jadvallarga qo'shimcha ustunlar va yangi jadvallar
qo'shiladi. Barcha o'zgarishlar additive: eski ma'lumotlar
saqlanadi, eski policy va indekslar tegilmaydi.

## 1. `customers` jadvalidagi yangi ustunlar
- `customer_number` (text) — mijoz avtomatik ID, `CL-001`
- `customer_type` (text) — new/regular/vip/inactive
- `source` (text) — mijoz manbasi

## 2. `orders` jadvalidagi yangi ustunlar
- `order_number` (text unique) — buyurtma ID `VP-001`
- `manager_id` (uuid) — menejer havolasi
- `customer_source` (text)
- `production_company` (text)
- `designer_name`, `designer_status`, `production_manager`,
  `logistics_manager`, `qc_manager` (text)
- `delivery_type`, `delivery_address`, `delivery_location_url`,
  `delivery_phone`, `courier` (text)
- `delivery_date` (date), `delivery_time` (text), `delivery_cost` (numeric)
- `subtotal` (numeric), `discount_amount` (numeric),
  `remaining_amount` (numeric)
- `payment_type` (text) — asosiy to'lov turi
- `customer_note`, `production_note`, `logistics_note`,
  `private_note`, `client_request_note` (text)
- `is_draft` (boolean, default false)
- `order_date` (date) — buyurtma sanasi (created_at dan alohida)

## 3. `order_files` jadvalidagi yangi ustunlar
- `link_type` (text) — telegram/image/pdf/archive/design/other
- `note` (text)

## 4. Yangi jadval: `order_products`
Bir buyurtmada bir nechta mahsulot qatorlari.

## 5. Yangi jadval: `order_payments`
Bir buyurtmada bir nechta to'lov (aralash to'lov uchun).

## 6. Xavfsizlik
- Yangi jadvallarda RLS yoqilgan
- CRUD `anon, authenticated` rollarga ochiq

## 7. Muhim eslatmalar
1. Eski buyurtmalar `order_number` ustunini keyinchalik oladi
   (yangi buyurtmalarda avtomatik yaratiladi).
2. Eski `total_amount`, `paid_amount` ustunlari saqlanib qoladi va
   yangi tizimda ham to'ldiriladi.
*/

-- 1. customers kengaytmasi
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_number text,
  ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS source text DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_number_uniq
  ON customers(customer_number)
  WHERE customer_number IS NOT NULL;

-- 2. orders kengaytmasi
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS manager_id uuid,
  ADD COLUMN IF NOT EXISTS customer_source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS production_company text DEFAULT '',
  ADD COLUMN IF NOT EXISTS designer_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS designer_status text DEFAULT '',
  ADD COLUMN IF NOT EXISTS production_manager text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logistics_manager text DEFAULT '',
  ADD COLUMN IF NOT EXISTS qc_manager text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_location_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS courier text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_cost numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS production_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logistics_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS private_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_request_note text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_date date;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_uniq
  ON orders(order_number)
  WHERE order_number IS NOT NULL;

-- 3. order_files kengaytmasi
ALTER TABLE order_files
  ADD COLUMN IF NOT EXISTS link_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS note text DEFAULT '';

-- 4. order_products
CREATE TABLE IF NOT EXISTS order_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  category text DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  variant text DEFAULT '',
  size text DEFAULT '',
  material text DEFAULT '',
  color text DEFAULT '',
  quantity numeric(14,2) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_products_order_id_idx
  ON order_products(order_id);

ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_products_select" ON order_products;
CREATE POLICY "order_products_select" ON order_products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "order_products_insert" ON order_products;
CREATE POLICY "order_products_insert" ON order_products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "order_products_update" ON order_products;
CREATE POLICY "order_products_update" ON order_products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "order_products_delete" ON order_products;
CREATE POLICY "order_products_delete" ON order_products FOR DELETE
  TO anon, authenticated USING (true);

-- 5. order_payments
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'cash',
  payment_date date DEFAULT CURRENT_DATE,
  received_by text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx
  ON order_payments(order_id);

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_payments_select" ON order_payments;
CREATE POLICY "order_payments_select" ON order_payments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "order_payments_insert" ON order_payments;
CREATE POLICY "order_payments_insert" ON order_payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "order_payments_update" ON order_payments;
CREATE POLICY "order_payments_update" ON order_payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "order_payments_delete" ON order_payments;
CREATE POLICY "order_payments_delete" ON order_payments FOR DELETE
  TO anon, authenticated USING (true);
