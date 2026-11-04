import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { report, SECTIONS } = require("../meta-webhook/checks/snapshot");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require("../meta-webhook/salesKpi");

const data = {
  now: Date.parse("2026-11-03T10:00:00+05:00"),
  orders: [
    { id: "a", manager_name: "Maryam", order_date: "2026-10-03", status: "delivered", total_amount: 5e6, paid_amount: 2e6, remaining_amount: 3e6, customer_name: "Secret LLC", customer_id: "c1" },
    { id: "b", manager_name: "Moxlaroy", order_date: "2026-09-10", status: "closed", total_amount: 1e6, paid_amount: 1e6 },
    { id: "c", manager_name: "Maryam", order_date: "2026-05-01", status: "closed", total_amount: 2e6, paid_amount: 2e6 },
  ],
  order_payments: [{ id: "p", order_id: "a", amount: 2e6, payment_date: "2026-10-04" }],
  order_products: [{ id: "l", order_id: "a", product_name: "Paket (A4)", total: 5e6 }],
  order_costs: [{ id: "a_L0", order_id: "a", total_cost: 3e6 }],
  managers: [{ id: "m", name: "Maryam", monthly_plan: 100e6 }],
  customers: [{ id: "c1", first_name: "Secret", phone: "+998901234567", industry: "Ta'lim" }],
  staff: [{ id: "x@vp.uz", full_name: "Maryam", report_manager_id: "m", amo_user_id: 7 }],
  kpi_sales: [],
  kpi_months: [],
  products: [{ id: "p1", name: "Paket", category: "Poligrafiya", price_tiers: [{ min_qty: 1, price: 1 }] }],
  guide_facts: [],
  lessons: [],
  amo_funnel: [],
  calls: [{ id: "k", start_time: "2026-10-02T10:00:00Z", answered: true, direction: "out", recording_url: "https://x/r.aac", duration_seconds: 95, phone: "+998901234567", client_name: "Secret" }],
  proposals: [{ id: "p", customer_id: "c1", total: 2e6, items: [{}], created_at: "2026-10-01T10:00:00Z", recipient_name: "Secret" }],
  amo_stats: [{ month: "2026-11", funnel: { "1:2": 3 }, leads: { created: 5, won: 1, lost: 2, won_amount: 1e6 }, loss: {} }],
  amo_status: { users: [{ id: 7, name: "Maryam" }], statuses: { "1:2": { pipeline: "Voronka", name: "Qabul", sort: 20 } } },
};

describe("business snapshot", () => {
  const text = report(data, SECTIONS, lib).join("\n");

  it("prints every section", () => {
    for (const s of ["sales by month", "managers", "kpi:", "debt by status", "cost coverage", "amo stages", "product cards"]) expect(text).toContain(s);
  });

  it("flags names missing from Managerlar and old months", () => {
    expect(text).toContain("2026-09 | Moxlaroy *");
    expect(text).toContain("2026-05 (import)");
    expect(text).toContain("2026-10 | orders 1/1 | revenue 5.0/5.0 | margin 40%");
  });

  it("describes product families for the sales guide", () => {
    expect(text).toContain("-- paket: 1 orders, 5.0 mln, 1 buyers");
    expect(text).toContain("who: Ta'lim 1");
  });

  it("never prints customer data", () => {
    expect(text).not.toContain("Secret");
    expect(text).not.toContain("998901234567");
  });
});
