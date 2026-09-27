// Writes a parsed Excel workbook (excelImport.ts) into the ERP as
// historical data: customers (+ their brands), closed archive orders with
// their product lines, payments and design links, and catalog products the
// ERP doesn't have yet.
//
// Everything goes through the same helpers as hand-entered data
// (saveOrder, numbering) and is tagged with `import_batch`, so a whole run
// can be undone from Sozlamalar → Excel import. Re-importing the same file
// skips orders already brought in (stable `import_key`).
import type { Brand, Customer, Product } from "./types";
import { listAll, listWhere, insertOne, upsertOne, updateOne, deleteOne, deleteWhere } from "./firestoreDb";
import { nextCustomerNumber, nextOrderNumber } from "./numbering";
import { saveOrder, type OrderPayload, type WizardPayment, type WizardProduct } from "./orderService";
import { normalizePhone } from "./format";
import { normText, type ImportCustomer, type ImportOrder, type ImportProduct, type ParsedWorkbook } from "./excelImport";

export type PaidMode = "paid" | "excel";

export type ImportBatch = {
  id: string;
  file_name: string;
  status: "running" | "done" | "failed" | "undone";
  paid_mode: PaidMode;
  date_from: string | null;
  date_to: string | null;
  customers_created: number;
  brands_created: number;
  orders_created: number;
  products_created: number;
  total_amount: number;
  error: string;
  created_by: string;
  created_at: string;
  finished_at: string | null;
};

type ExistingOrder = { id: string; import_key?: string; customer_id: string | null; import_batch?: string };

export type ImportPlan = {
  parsed: ParsedWorkbook;
  customers: { item: ImportCustomer; existing: Customer | null }[];
  orders: { item: ImportOrder; duplicate: boolean }[];
  products: { item: ImportProduct; existing: Product | null }[];
  newCustomers: number;
  newOrders: number;
  duplicateOrders: number;
  newProducts: number;
  total: number; // of new orders
  advance: number; // of new orders
};

const orderKeyOf = (o: ImportOrder) => `xl:${o.refs[0] || o.rows[0]}:${o.date}:${o.customer_key}`;

const customerMatcher = (existing: Customer[]) => {
  const byPhone = new Map<string, Customer>();
  const byName = new Map<string, Customer>();
  for (const c of existing) {
    for (const p of [c.phone, c.extra_phone]) {
      const k = normalizePhone(p || "");
      if (k.length === 9 && !byPhone.has(k)) byPhone.set(k, c);
    }
    const n = normText(`${c.first_name} ${c.last_name}`);
    if (n && !byName.has(n)) byName.set(n, c);
  }
  return (c: ImportCustomer): Customer | null =>
    c.phone ? byPhone.get(normalizePhone(c.phone)) || null : byName.get(normText(`${c.first_name} ${c.last_name}`)) || null;
};

// Read-only: what the import would do against today's data.
export const planImport = async (parsed: ParsedWorkbook): Promise<ImportPlan> => {
  const [customers, orders, products] = await Promise.all([
    listAll<Customer>("customers"),
    listAll<ExistingOrder>("orders"),
    listAll<Product>("products"),
  ]);
  const match = customerMatcher(customers);
  const keys = new Set(orders.map((o) => o.import_key).filter(Boolean));
  const productByName = new Map(products.map((p) => [normText(p.name), p]));

  const planCustomers = parsed.customers.map((item) => ({ item, existing: match(item) }));
  const planOrders = parsed.orders.map((item) => ({ item, duplicate: keys.has(orderKeyOf(item)) }));
  const planProducts = parsed.products.map((item) => ({ item, existing: productByName.get(normText(item.name)) || null }));
  const fresh = planOrders.filter((o) => !o.duplicate);
  return {
    parsed,
    customers: planCustomers,
    orders: planOrders,
    products: planProducts,
    newCustomers: planCustomers.filter((c) => !c.existing).length,
    newOrders: fresh.length,
    duplicateOrders: planOrders.length - fresh.length,
    newProducts: planProducts.filter((p) => !p.existing).length,
    total: fresh.reduce((s, o) => s + o.item.total, 0),
    advance: fresh.reduce((s, o) => s + o.item.advance, 0),
  };
};

const seq = (first: string) => {
  const m = /^([A-Z]+)-(\d+)$/.exec(first);
  if (!m) throw new Error(`Raqamlash xatosi: ${first}`);
  let n = parseInt(m[2], 10);
  const width = Math.max(3, m[2].length);
  return () => `${m[1]}-${String(n++).padStart(width, "0")}`;
};

const noonOf = (day: string) => `${day}T12:00:00.000Z`;

export type ImportProgress = { done: number; total: number; label: string };

export const runImport = async (
  plan: ImportPlan,
  opts: { fileName: string; paidMode: PaidMode; actor: string; onProgress?: (p: ImportProgress) => void },
): Promise<ImportBatch> => {
  const batch = await insertOne("import_batches", {
    file_name: opts.fileName,
    status: "running",
    paid_mode: opts.paidMode,
    date_from: plan.parsed.date_from,
    date_to: plan.parsed.date_to,
    customers_created: 0,
    brands_created: 0,
    orders_created: 0,
    products_created: 0,
    total_amount: 0,
    error: "",
    created_by: opts.actor,
    finished_at: null,
  });
  const batchId = batch.id;
  const counts = { customers_created: 0, brands_created: 0, orders_created: 0, products_created: 0, total_amount: 0 };
  const newOrders = plan.orders.filter((o) => !o.duplicate).map((o) => o.item);
  const newProducts = plan.products.filter((p) => !p.existing).map((p) => p.item);
  const steps = plan.customers.length + newOrders.length + newProducts.length;
  let done = 0;
  const tick = (label: string) => opts.onProgress?.({ done: ++done, total: steps, label });

  try {
    // Customers and their brands
    const nextCustomer = seq(await nextCustomerNumber());
    const allBrands = await listAll<Brand>("brands");
    const customerIdByKey = new Map<string, string>();
    const brandId = new Map<string, string>(); // `${customerId}|${brand}` → id
    for (const b of allBrands) brandId.set(`${b.customer_id}|${normText(b.name)}`, b.id);

    for (const { item, existing } of plan.customers) {
      let id = existing?.id;
      if (!id) {
        const created = await insertOne("customers", {
          customer_number: nextCustomer(),
          customer_type: "new",
          source: "Eski mijoz",
          industry: "",
          first_name: item.first_name || item.brands[0] || "Noma'lum",
          last_name: item.last_name,
          phone: item.phone,
          extra_phone: item.extra_phone,
          telegram: item.telegram,
          company: item.brands[0] || "",
          position: "",
          region: item.region,
          address: "",
          note: `Excel importdan (${opts.fileName})`,
          manager_name: "",
          import_batch: batchId,
          created_at: noonOf(item.first_date),
        });
        id = created.id;
        counts.customers_created++;
      }
      customerIdByKey.set(item.key, id);
      for (const name of item.brands) {
        const k = `${id}|${normText(name)}`;
        if (brandId.has(k)) continue;
        const b = await insertOne("brands", { customer_id: id, name, logo_url: "", note: "", import_batch: batchId, created_at: noonOf(item.first_date) });
        brandId.set(k, b.id);
        counts.brands_created++;
      }
      tick(`Mijoz: ${item.first_name} ${item.last_name}`.trim());
    }

    // Orders
    const nextOrder = seq(await nextOrderNumber());
    for (const o of newOrders) {
      const customerId = customerIdByKey.get(o.customer_key) || null;
      const products: WizardProduct[] = o.lines.map((l, i) => ({
        position: i,
        category: l.category,
        product_name: l.product_name,
        variant: "",
        size: "",
        material: "",
        color: "",
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: 0,
        total: l.total,
        note: [l.ref && `Excel ID: ${l.ref}`, l.note].filter(Boolean).join(" · "),
        size_breakdown: [],
        files: l.files.map((f) => ({ filename: f.label, url: f.url, link_type: /rasm/i.test(f.label) ? "Rasm" : /dizayn/i.test(f.label) ? "Dizayn" : "Telegram", note: "" })),
        production_status: "delivered",
        production_company: l.producer,
        assigned_printer_email: "",
        assigned_printer_name: "",
        production_accepted_at: null,
        production_completed_at: o.date,
      }));
      const paid = opts.paidMode === "paid" ? o.total : o.advance;
      const payments: WizardPayment[] =
        paid > 0 ? [{ amount: paid, payment_type: o.payment_type, payment_date: o.date, received_by: "Excel import", note: o.check_url ? `Chek: ${o.check_url}` : "" }] : [];
      const payload: OrderPayload = {
        order_number: nextOrder(),
        brand_id: (customerId && o.brand && brandId.get(`${customerId}|${normText(o.brand)}`)) || null,
        customer_id: customerId,
        manager_id: null,
        manager_name: "",
        title: o.lines.length > 1 ? `${o.lines[0].product_name} va yana ${o.lines.length - 1} ta` : o.lines[0].product_name,
        description: "",
        status: "closed",
        order_date: o.date,
        deadline: o.deadline,
        customer_source: "Eski mijoz",
        production_company: o.producer,
        textile_company_id: null,
        textile_company_name: "",
        designer_name: o.designer,
        designer_status: "",
        production_manager: "",
        logistics_manager: "",
        qc_manager: "",
        assigned_printer_email: "",
        assigned_printer_name: "",
        delivery_type: "",
        delivery_address: "",
        delivery_location_url: "",
        delivery_phone: "",
        courier: "",
        delivery_date: null,
        delivery_time: "",
        delivery_cost: 0,
        payment_type: o.payment_type,
        telegram_link: "",
        customer_note: "",
        production_note: "",
        logistics_note: o.delivery_note,
        private_note: [`Excel import: ${opts.fileName}`, o.branch && `Filial: ${o.branch}`, `Excel qatorlari: ${o.rows.join(", ")}`].filter(Boolean).join(" · "),
        client_request_note: "",
        discount_amount: 0,
        is_draft: false,
        is_historical: true,
        historical_ref: o.refs.join(", "),
        import_batch: batchId,
        import_key: orderKeyOf(o),
        created_at: noonOf(o.date),
      };
      const res = await saveOrder(payload, products, payments);
      if ("error" in res) throw new Error(`${o.refs.join(", ")}: ${res.error}`);
      counts.orders_created++;
      counts.total_amount += o.total;
      tick(`Buyurtma: ${o.refs.join(", ") || o.date}`);
    }

    // Catalog products the ERP doesn't have yet
    for (const p of newProducts) {
      const tiers = p.tiers.map((t) => ({ min_qty: t.min_qty, price: t.price }));
      const created = await insertOne("products", {
        name: p.name,
        category: p.category,
        unit: "dona",
        price_tiers: tiers,
        base_price: tiers[0].price,
        sizes: [],
        colors: [],
        product_code: "",
        image_url: "",
        min_order_qty: tiers[0].min_qty,
        lead_time_days: 0,
        is_active: true,
        size_spec: "",
        material: "",
        print_type: "",
        paper_weight: "",
        lamination: "",
        packaging: "",
        spec_note: "",
        description: "",
        advantages: [],
        recommended_for: [],
        sales_notes: "",
        manager_tip: "",
        upsell_product_ids: [],
        import_batch: batchId,
      });
      if (p.tiers.some((t) => t.cost > 0)) {
        // Cost prices are admin-only; a manager account just skips them.
        await upsertOne("product_costs", created.id, {
          cost_tiers: p.tiers.map((t) => ({ min_qty: t.min_qty, cost_price: t.cost })),
          updated_at: new Date().toISOString(),
        }).catch(() => undefined);
      }
      counts.products_created++;
      tick(`Mahsulot: ${p.name}`);
    }

    await updateOne("import_batches", batchId, { ...counts, status: "done", finished_at: new Date().toISOString() });
    return { ...(batch as unknown as ImportBatch), ...counts, status: "done" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Xatolik";
    await updateOne("import_batches", batchId, { ...counts, status: "failed", error, finished_at: new Date().toISOString() });
    throw new Error(`${error} — shu paytgacha kiritilganlar «Qaytarish» bilan o'chiriladi.`);
  }
};

// Removes everything one run created. A customer or brand is kept if
// orders from outside this import point to it by now.
export const undoImport = async (batchId: string, onProgress?: (p: ImportProgress) => void) => {
  const [orders, customers, brands, products] = await Promise.all([
    listWhere<ExistingOrder>("orders", "import_batch", batchId),
    listWhere<Customer>("customers", "import_batch", batchId),
    listWhere<Brand>("brands", "import_batch", batchId),
    listWhere<Product>("products", "import_batch", batchId),
  ]);
  const total = orders.length + customers.length + brands.length + products.length;
  let done = 0;
  const tick = (label: string) => onProgress?.({ done: ++done, total, label });

  for (const o of orders) {
    await Promise.all(["order_products", "order_payments", "order_files", "order_status_history"].map((c) => deleteWhere(c, "order_id", o.id)));
    await deleteOne("orders", o.id);
    tick("Buyurtmalar o'chirilmoqda");
  }
  let keptCustomers = 0;
  for (const c of customers) {
    const others = await listWhere<ExistingOrder>("orders", "customer_id", c.id);
    if (others.length) keptCustomers++;
    else await deleteOne("customers", c.id);
    tick("Mijozlar o'chirilmoqda");
  }
  for (const b of brands) {
    const others = await listWhere<ExistingOrder>("orders", "brand_id", b.id);
    if (!others.length) await deleteOne("brands", b.id);
    tick("Brendlar o'chirilmoqda");
  }
  for (const p of products) {
    await deleteOne("products", p.id);
    await deleteOne("product_costs", p.id).catch(() => undefined);
    tick("Mahsulotlar o'chirilmoqda");
  }
  await updateOne("import_batches", batchId, { status: "undone", finished_at: new Date().toISOString() });
  return { orders: orders.length, customers: customers.length - keptCustomers, keptCustomers, products: products.length };
};
