/*
# Add performance indexes

Adds indexes for the most common query paths in the app to speed up list, detail,
and numbering lookups. All are idempotent (CREATE INDEX IF NOT EXISTS).

1. Indexes
- `idx_orders_customer_id` — customer detail page and promotion checks
- `idx_orders_brand_id` — brand detail queries
- `idx_orders_status` — dashboard status counts, filters
- `idx_orders_created_at` — recent orders / list sort (DESC)
- `idx_orders_order_date` — order-date filters
- `idx_order_products_order_id` — child rows for each order
- `idx_order_payments_order_id`
- `idx_order_files_order_id`
- `idx_brands_customer_id` — brand list per customer
- `idx_holidays_date` — holiday lookup by ISO date
- `idx_customers_created_at`
2. Security
- No RLS changes. Indexes do not affect row-level security.
*/

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

CREATE INDEX IF NOT EXISTS idx_order_products_order_id ON order_products(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);

CREATE INDEX IF NOT EXISTS idx_brands_customer_id ON brands(customer_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
