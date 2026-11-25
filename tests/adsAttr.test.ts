import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { aggregateMoney, profitOf } from "../src/lib/adsSpend";
const require = createRequire(import.meta.url);
const AT = require("../meta-webhook/adsAttr.js");

const lead = (id: string, at: string, phone: string, extra = {}) => ({ id, source: "Facebook Lead Ads", created_at: at, phone, campaign_id: "c1", adset_id: "s1", ad_id: "a1", ...extra });
const order = (id: string, cust: string, day: string, total: number, extra = {}) => ({ id, customer_id: cust, order_date: day, total_amount: total, paid_amount: 0, status: "new", is_draft: false, ...extra });

describe("attribute", () => {
  const customers = [{ id: "k1", phone: "+998 90 123-45-67" }, { id: "k2", phone: "991112233", extra_phone: "+998 93 000 11 22" }];
  const orders = [
    order("o0", "k2", "2026-10-01", 500000), // k2 bought before → repeat
    order("o1", "k1", "2026-11-15", 4000000, { paid_amount: 1000000 }),
    order("o2", "k1", "2026-12-20", 1000000),
    order("o3", "k2", "2026-11-20", 2000000),
    order("o4", "k1", "2026-11-16", 900000, { status: "cancelled" }),
    order("o9", "k1", "2027-03-01", 700000), // after 60 days
  ];
  const leads = [lead("L1", "2026-11-14T06:00:00Z", "901234567"), lead("L2", "2026-11-15T06:00:00Z", "+998901234567"), lead("L3", "2026-11-19T06:00:00Z", "93 000 11 22", { ad_id: "a2" }), lead("X", "2026-11-19T06:00:00Z", "1", { source: "Telefon" })];
  const rows = AT.attribute({ leads, customers, orders, costs: [{ order_id: "o1", total_cost: 2600000 }], payments: [{ order_id: "o3", amount: 2000000 }], today: "2026-11-25" });
  it("matches by the last 9 digits, 60 days, one order to one lead, skips cancelled", () => {
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["L1", "L2", "L3"]);
    const L1 = rows[0];
    expect(L1.orders).toBe(2); // o1 + o2 (within 60 days)
    expect(L1.revenue).toBe(5000000);
    expect(L1.paid).toBe(1000000);
    expect(L1.cost).toBe(2600000);
    expect(L1.cost_rev).toBe(4000000);
    expect(L1.new).toBe(true);
    expect(rows[1].orders).toBe(0); // L2's orders already counted for L1
    expect(rows[1].found).toBe(true);
  });
  it("repeat customer and payments", () => {
    const L3 = rows[2];
    expect(L3.orders).toBe(1);
    expect(L3.new).toBe(false);
    expect(L3.paid).toBe(2000000);
    expect(L3.a).toBe("a2");
  });
  it("a CRM-converted lead keeps its order without a phone", () => {
    const r = AT.attribute({ leads: [lead("L9", "2026-11-14T06:00:00Z", "", { converted_order_id: "o3" })], customers, orders, today: "2026-11-25" });
    expect(r[0].orders).toBe(1);
    expect(r[0].revenue).toBe(2000000);
  });
  it("no names or phones in the rows", () => {
    expect(JSON.stringify(rows)).not.toMatch(/901234567|phone/);
  });
});

describe("money on the page", () => {
  const rows = [
    { id: "1", day: "2026-11-14", c: "c1", s: "s1", a: "a1", found: true, orders: 2, revenue: 5000000, paid: 1000000, cost: 2600000, cost_rev: 4000000, new: true, first: "2026-11-15", open: true },
    { id: "2", day: "2026-11-19", c: "c1", s: "s1", a: "a2", found: true, orders: 1, revenue: 2000000, paid: 2000000, cost: 0, cost_rev: 0, new: false, first: "2026-11-20", open: true },
    { id: "3", day: "2026-11-19", c: "c2", s: "s2", a: "a3", found: false, orders: 0, revenue: 0, paid: 0, cost: 0, cost_rev: 0, new: false, first: null, open: true },
  ];
  it("sums by period and by id", () => {
    const g = aggregateMoney(rows, "2026-11-14", "2026-11-30");
    expect(g.total).toMatchObject({ leads: 3, found: 2, ordered: 2, orders: 3, revenue: 7000000, newCustomers: 1 });
    expect(g.by.get("c:c1")!.revenue).toBe(7000000);
    expect(g.by.get("a:a2")!.orders).toBe(1);
    expect(aggregateMoney(rows, "2026-11-19", "2026-11-19").total.leads).toBe(2);
  });
  it("profit with estimated cost for uncosted sales", () => {
    const p = profitOf(aggregateMoney(rows, "2026-11-01", "2026-11-30").total, 1000000);
    // cost ratio 2.6/4 = 0.65 → cost 2.6 + 3.0 × 0.65 = 4.55 mln
    expect(p.cost).toBe(4550000);
    expect(p.profit).toBe(7000000 - 4550000 - 1000000);
    expect(p.estimated).toBe(true);
    expect(p.roas).toBe(7);
    expect(p.cac).toBe(1000000);
    const none = profitOf({ leads: 1, found: 1, ordered: 1, orders: 1, revenue: 100, paid: 0, cost: 0, cost_rev: 0, newCustomers: 0, open: 0 }, 50);
    expect(none.profit).toBeNull();
  });
});
