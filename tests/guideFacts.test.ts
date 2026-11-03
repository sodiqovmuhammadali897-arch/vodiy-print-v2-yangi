import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeFacts, familyOf, FAMILIES } = require("../meta-webhook/guideFacts");
import { LESSONS } from "../src/modules/darslik/lessonsData";

const orders = [
  { id: "o1", order_date: "2026-10-02", status: "closed", customer_id: "c1" },
  { id: "o2", order_date: "2026-10-20", status: "delivered", customer_id: "c1" },
  { id: "o3", order_date: "2026-09-05", status: "new", customer_id: "c2" },
  { id: "o4", order_date: "2026-05-05", status: "closed", customer_id: "c2" }, // before the ERP: left out
  { id: "o5", order_date: "2026-10-05", status: "cancelled", customer_id: "c2" }, // cancelled: left out
];
const lines = [
  { id: "a", order_id: "o1", product_name: "Paket 2", quantity: 200, unit_price: 13000, total: 2_600_000, size: "31-24-8,5" },
  { id: "b", order_id: "o1", product_name: "Blaknot", quantity: 100, unit_price: 12000, total: 1_200_000 },
  { id: "c", order_id: "o2", product_name: "paket", quantity: 300, unit_price: 12000, total: 3_600_000, size: "31-24-8,5" },
  { id: "d", order_id: "o3", product_name: "Paket 41", quantity: 100, unit_price: 18000, total: 1_800_000 },
  { id: "e", order_id: "o4", product_name: "Paket", quantity: 999, unit_price: 1, total: 999 },
  { id: "f", order_id: "o5", product_name: "Paket", quantity: 999, unit_price: 1, total: 999 },
  { id: "g", order_id: "o3", product_name: "Logotip chizish", quantity: 1, unit_price: 500_000, total: 500_000 },
];
const customers = [
  { id: "c1", first_name: "Ali", phone: "+998901112233", industry: "Savdo" },
  { id: "c2", first_name: "Vali", industry: "" },
];
const products = [
  { id: "p1", name: "Paket 2", category: "Tipografiya", image_url: "x", min_order_qty: 100, lead_time_days: 5, price_tiers: [{ min_qty: 1000, price: 7900 }, { min_qty: 100, price: 15900 }] },
  { id: "p2", name: "Paket 8", category: "Tipografiya", min_order_qty: 100, lead_time_days: 6, price_tiers: [{ min_qty: 100, price: 15500 }] },
  { id: "p3", name: "Paket 8", category: "", price_tiers: [] },
  { id: "p4", name: "Blaknot", category: "Tipografiya", image_url: "y", price_tiers: [{ min_qty: 100, price: 15900 }] },
];

describe("guide facts", () => {
  const { meta, families } = computeFacts({ orders, lines, customers, products });
  const paket = families.find((f: { key: string }) => f.key === "paket");

  it("groups hand-typed lines into families and counts only ERP-era sales", () => {
    expect(familyOf("Standart SET (paket, bloknot, ruchka)")).toBe("gift-box");
    expect(familyOf("Koja bloknot 0020")).toBe("bloknot");
    expect(familyOf("Kamzul-Eco koja( Nimcha)")).toBe("ustki-kiyim");
    expect(paket).toMatchObject({ rank: 1, orders: 3, revenue: 8_000_000, buyers: 2, repeat_buyers: 1, qty_median: 200, lesson: "paket" });
    expect(paket.months).toEqual({ "2026-09": 1_800_000, "2026-10": 6_200_000 });
  });

  it("says who buys it, what with, and the catalog models", () => {
    expect(paket.who).toEqual([{ name: "Savdo", n: 2 }]);
    expect(paket.who_unknown).toBe(1);
    expect(paket.with).toEqual([{ key: "bloknot", n: 1, title: "Bloknot" }]);
    expect(paket.specs[0]).toEqual({ text: "31-24-8,5", n: 2 });
    expect(paket.models[0].tiers).toEqual([{ min_qty: 100, price: 15900 }, { min_qty: 1000, price: 7900 }]);
    expect(paket.price_from).toBe(7900);
    expect(paket.lead_days).toEqual({ min: 5, max: 6 });
  });

  it("lists catalog gaps for the admin", () => {
    expect(meta).toMatchObject({ no_image: 2, no_category: 1, duplicate_names: ["Paket 8"], unmatched_revenue: 500_000, total_revenue: 9_700_000 });
  });

  it("keeps docs small: no inline images", () => {
    const big = computeFacts({ orders, lines, customers, products: products.map((p) => ({ ...p, image_url: p.image_url ? `data:image/png;base64,${"A".repeat(500_000)}` : "" })) });
    const doc = big.families.find((f: { key: string }) => f.key === "paket");
    expect(JSON.stringify(doc).length).toBeLessThan(10_000);
    expect(doc.models[0].has_image).toBe(true);
  });

  it("never stores customer names or phones", () => {
    const text = JSON.stringify({ meta, families });
    expect(text).not.toContain("Ali");
    expect(text).not.toContain("998901112233");
  });

  it("points every family at a real Darslik lesson", () => {
    const keys = new Set(LESSONS.map((l) => l.key));
    for (const f of FAMILIES) expect(keys.has(f.lesson)).toBe(true);
  });
});
