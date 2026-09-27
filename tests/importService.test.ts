import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cell } from "../src/lib/excelImport";

// In-memory stand-in for src/lib/firestoreDb so the importer runs end to
// end (numbering, saveOrder, undo) without Firebase.
type Row = Record<string, unknown> & { id: string };
const store: Record<string, Map<string, Row>> = {};
let seq = 0;
const col = (name: string) => (store[name] ||= new Map());
const stamp = (d: Record<string, unknown>) => ("created_at" in d ? d : { ...d, created_at: new Date().toISOString() });

vi.mock("../src/lib/firestoreDb", () => ({
  listAll: async (name: string) => [...col(name).values()].map((r) => ({ ...r })),
  listWhere: async (name: string, f: string, v: unknown) => [...col(name).values()].filter((r) => r[f] === v).map((r) => ({ ...r })),
  getOne: async (name: string, id: string) => (col(name).has(id) ? { ...col(name).get(id)! } : null),
  insertOne: async (name: string, data: Record<string, unknown>) => {
    const id = `${name}-${++seq}`;
    const row = { ...stamp(data), id };
    col(name).set(id, row);
    return row;
  },
  insertMany: async (name: string, rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      const id = `${name}-${++seq}`;
      col(name).set(id, { ...stamp(r), id });
    }
  },
  upsertOne: async (name: string, id: string, data: Record<string, unknown>) => {
    col(name).set(id, { ...(col(name).get(id) || {}), ...stamp(data), id });
    return { ...data, id };
  },
  updateOne: async (name: string, id: string, data: Record<string, unknown>) => {
    col(name).set(id, { ...col(name).get(id)!, ...data });
  },
  deleteOne: async (name: string, id: string) => void col(name).delete(id),
  deleteWhere: async (name: string, f: string, v: unknown) => {
    for (const [id, r] of col(name)) if (r[f] === v) col(name).delete(id);
  },
  countWhere: async (name: string, f: string, v: unknown) => [...col(name).values()].filter((r) => r[f] === v).length,
}));

const { parseWorkbook } = await import("../src/lib/excelImport");
const { planImport, runImport, undoImport } = await import("../src/lib/importService");

const HEADER: Cell[] = ["ID", "Qayerga", "Sana", "Ism", "Familiya", "Nomer-1", "Brend", "Mahsulot", "Soni", "Jami summa", "Avans", "To'lov turi", "Dizayn Fayl", "Kimga berildi"];
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const sheets = () => [
  {
    sheet: "Buyurtmalar",
    data: [
      HEADER,
      ["Far001", "Poligrafiya", d("2025-11-24"), "Bunyod", "Bahromov", 905700103, "Muxtasham", "Paket A4", 200, 2434040, 1800000, "Karta Farg'ona", "https://t.me/c/1/2", "Kans print"],
      ["Far002", "Poligrafiya", d("2025-11-24"), "Bunyod", "Bahromov", 905700103, "Muxtasham", "Ruchka", 200, 1000000, null, "Karta Farg'ona", null, "Kans print"],
      ["Nam001", "Tipografiya", d("2025-12-02"), "Olim", null, 998901112233, "Olim Group", "Vizitka", 1000, 300000, 0, "Naqd Namangan", null, null],
    ] as Cell[][],
  },
  {
    sheet: "Maxsulotlar",
    data: [
      ["kubarik", "Umumiy tan narx", null, "Sotish narxi"],
      [null, "Donaga", "Jami", "Donaga"],
      ["Paket A4", null, null, null],
      [100, 9000, 900000, 12000],
      ["Vizitka", null, null, null],
      [1000, 200, 200000, 320],
    ] as Cell[][],
  },
];

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  seq = 0;
  // An existing customer (same phone as Olim) and product, plus a live order.
  col("customers").set("c-old", { id: "c-old", customer_number: "CL-007", first_name: "Olim", last_name: "Karimov", phone: "+998 90 111 22 33", extra_phone: "" });
  col("products").set("p-old", { id: "p-old", name: "Vizitka" });
  col("orders").set("o-live", { id: "o-live", order_number: "VP-041", customer_id: "c-old" });
});

describe("excel import into the ERP", () => {
  it("plans, imports as paid archive orders, skips re-imports and undoes cleanly", async () => {
    const plan = await planImport(parseWorkbook(sheets()));
    expect(plan.newOrders).toBe(2);
    expect(plan.newCustomers).toBe(1); // Olim matched by phone
    expect(plan.newProducts).toBe(1); // Vizitka already exists
    expect(plan.total).toBe(3734040);

    const batch = await runImport(plan, { fileName: "test.xlsx", paidMode: "paid", actor: "Admin" });
    expect(batch).toMatchObject({ orders_created: 2, customers_created: 1, brands_created: 2, products_created: 1, status: "done" });

    const orders = [...col("orders").values()].filter((o) => o.import_batch);
    expect(orders.map((o) => o.order_number).sort()).toEqual(["VP-042", "VP-043"]);
    const bunyod = orders.find((o) => o.historical_ref === "Far001, Far002")!;
    expect(bunyod).toMatchObject({
      status: "closed",
      is_historical: true,
      order_date: "2025-11-24",
      created_at: "2025-11-24T12:00:00.000Z",
      completed_at: "2025-11-24T12:00:00.000Z",
      total_amount: 3434040,
      paid_amount: 3434040,
      remaining_amount: 0,
      payment_type: "Karta",
      production_company: "Kans print",
    });
    const newCustomer = [...col("customers").values()].find((c) => c.first_name === "Bunyod")!;
    expect(newCustomer).toMatchObject({ customer_number: "CL-008", phone: "+998 90 570 01 03", company: "Muxtasham", created_at: "2025-11-24T12:00:00.000Z" });
    expect(bunyod.customer_id).toBe(newCustomer.id);
    expect(orders.find((o) => o.historical_ref === "Nam001")!.customer_id).toBe("c-old");
    const lines = [...col("order_products").values()].filter((l) => l.order_id === bunyod.id);
    expect(lines.map((l) => [l.product_name, l.quantity, l.total])).toEqual([["Paket A4", 200, 2434040], ["Ruchka", 200, 1000000]]);
    expect([...col("order_payments").values()].filter((p) => p.order_id === bunyod.id).map((p) => [p.amount, p.payment_date])).toEqual([[3434040, "2025-11-24"]]);
    expect([...col("order_files").values()].filter((f) => f.order_id === bunyod.id).map((f) => f.url)).toEqual(["https://t.me/c/1/2"]);
    const paket = [...col("products").values()].find((p) => p.name === "Paket A4")!;
    expect(paket).toMatchObject({ category: "Poligrafiya", price_tiers: [{ min_qty: 100, price: 12000 }] });
    expect(col("product_costs").get(paket.id)).toMatchObject({ cost_tiers: [{ min_qty: 100, cost_price: 9000 }] });

    // The same file again: nothing new.
    const again = await planImport(parseWorkbook(sheets()));
    expect(again.newOrders).toBe(0);
    expect(again.duplicateOrders).toBe(2);
    expect(again.newCustomers).toBe(0);
    expect(again.newProducts).toBe(0);

    // Undo removes the run but keeps the pre-existing data.
    const undone = await undoImport(batch.id!);
    expect(undone).toMatchObject({ orders: 2, customers: 1, products: 1 });
    expect([...col("orders").keys()]).toEqual(["o-live"]);
    expect([...col("customers").keys()]).toEqual(["c-old"]);
    expect([...col("products").keys()]).toEqual(["p-old"]);
    expect(col("order_products").size + col("order_payments").size + col("order_files").size).toBe(0);
    expect(col("brands").size).toBe(0);
    expect(col("import_batches").get(batch.id!)!.status).toBe("undone");
  });

  it("keeps Excel's unpaid remainder as debt in 'excel' mode", async () => {
    const plan = await planImport(parseWorkbook(sheets()));
    await runImport(plan, { fileName: "t.xlsx", paidMode: "excel", actor: "Admin" });
    const bunyod = [...col("orders").values()].find((o) => o.historical_ref === "Far001, Far002")!;
    expect(bunyod).toMatchObject({ paid_amount: 1800000, remaining_amount: 1634040 });
    const olim = [...col("orders").values()].find((o) => o.historical_ref === "Nam001")!;
    expect(olim).toMatchObject({ paid_amount: 0, remaining_amount: 300000 });
  });
});
