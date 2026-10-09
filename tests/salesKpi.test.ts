import { describe, expect, it } from "vitest";
import { computeKpi, DEFAULT_SALES_KPI, ratesFor, short } from "../src/lib/salesKpi";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { summarize, monthBefore } = require("../meta-webhook/salesKpi");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reportText } = require("../meta-webhook/bonus");

const rates = { plan: 80e6, sales_rate: 7.5, collect_rate: 2 };
const base = { sales: 100e6, collected: 50e6, rates, threshold: 80, attendancePct: 92, attendanceLinked: true, amoPct: null };

describe("KPI (sotuv)", () => {
  it("pays the sales part always and the collect part when attendance holds", () => {
    const r = computeKpi(base);
    expect(r.salesBonus).toBe(7_500_000);
    expect(r.collectBonus).toBe(1_000_000);
    expect(r.payout).toBe(8_500_000);
    expect(r.planPct).toBeCloseTo(125);
  });

  it("drops the collect part below the threshold", () => {
    const r = computeKpi({ ...base, attendancePct: 76 });
    expect(r.eligible).toBe(false);
    expect(r.collectPotential).toBe(1_000_000);
    expect(r.collectBonus).toBe(0);
    expect(r.payout).toBe(7_500_000);
    expect(computeKpi({ ...base, attendancePct: 80 }).eligible).toBe(true);
    expect(computeKpi({ ...base, amoPct: 72 }).eligible).toBe(false);
    // No employee account linked: attendance can't be checked.
    expect(computeKpi({ ...base, attendanceLinked: false }).eligible).toBe(false);
    // First day of the month, nothing to count yet.
    expect(computeKpi({ ...base, attendancePct: null }).eligible).toBe(true);
  });

  it("takes the month's rates, else the manager's, else the defaults", () => {
    const m = { monthly_plan: 60e6, sales_rate: 8, collect_rate: null };
    expect(ratesFor(m, null, DEFAULT_SALES_KPI)).toEqual({ plan: 60e6, sales_rate: 8, collect_rate: 2 });
    expect(ratesFor(m, { plan: 80e6, sales_rate: null, collect_rate: 3 } as never, DEFAULT_SALES_KPI)).toEqual({ plan: 80e6, sales_rate: 8, collect_rate: 3 });
    expect(ratesFor({ monthly_plan: 0 }, null, DEFAULT_SALES_KPI)).toEqual({ plan: 0, sales_rate: 7.5, collect_rate: 2 });
    expect(short(80e6)).toBe("80 mln");
  });
});

describe("KPI server sums", () => {
  const managers = [
    { id: "m1", name: "Maryam" },
    { id: "m2", name: "Dilmurod" },
  ];
  const orders = [
    { id: "a", order_number: "VP-1", manager_name: "Maryam", total_amount: 10e6, paid_amount: 4e6, order_date: "2026-10-02", status: "new" },
    { id: "b", order_number: "VP-2", manager_name: " maryam ", total_amount: 5e6, paid_amount: 0, order_date: "2026-10-05", status: "new" },
    { id: "c", order_number: "VP-3", manager_name: "Maryam", total_amount: 7e6, paid_amount: 2e6, order_date: "2026-09-20", status: "new" },
    { id: "d", order_number: "VP-4", manager_name: "Maryam", total_amount: 9e6, order_date: "2026-10-06", status: "cancelled" },
    { id: "e", order_number: "VP-5", manager_name: "Maryam", total_amount: 3e6, order_date: "2026-10-06", status: "new", is_draft: true },
    { id: "f", order_number: "VP-6", manager_name: "Dilmurod", total_amount: 20e6, paid_amount: 20e6, order_date: "2026-10-03", status: "done" },
    { id: "g", order_number: "VP-7", manager_name: "Nobody", total_amount: 1e6, order_date: "2026-10-03", status: "new" },
  ];
  const payments = [
    { id: "p1", order_id: "a", amount: 4e6, payment_date: "2026-10-02" },
    { id: "p2", order_id: "c", amount: 2e6, payment_date: "2026-10-01" }, // old order's debt, paid this month
    { id: "p3", order_id: "c", amount: 1e6, payment_date: "2026-09-25" }, // last month
    { id: "p4", order_id: "d", amount: 1e6, payment_date: "2026-10-06" }, // cancelled order
    { id: "p5", order_id: "f", amount: 20e6, payment_date: "2026-10-03" },
  ];

  it("adds up a manager's sales, money in and debt for the month", () => {
    const docs = summarize({ orders, payments, managers, month: "2026-10" });
    const m = docs.find((d: { manager_id: string }) => d.manager_id === "m1");
    expect(m.id).toBe("2026-10_m1");
    expect(m.sales).toBe(15e6);
    expect(m.order_count).toBe(2);
    expect(m.orders.map((o: { n: string }) => o.n)).toEqual(["VP-2", "VP-1"]);
    expect(m.collected).toBe(6e6);
    expect(m.payments.map((p: { id: string }) => p.id)).toEqual(["p1", "p2"]);
    expect(m.debt).toBe(6e6 + 5e6 + 5e6);
    const d = docs.find((x: { manager_id: string }) => x.manager_id === "m2");
    expect([d.sales, d.collected, d.debt]).toEqual([20e6, 20e6, 0]);
    expect(monthBefore("2026-01")).toBe("2025-12");
  });

  it("writes the approved month's report", () => {
    const text = reportText({
      month: "2026-10",
      snapshot: { plan: 80e6, sales: 100e6, collected: 50e6, sales_rate: 7.5, collect_rate: 2, threshold: 80, attendance_pct: 76, amo_pct: null, sales_bonus: 7.5e6, collect_bonus: 0, eligible: false, payout: 7.5e6 },
    });
    expect(text).toContain("Sotuv: 100 000 000 so'm (reja 80 000 000 so'm, 125%)");
    expect(text).toContain("➕ 7,5%: 7 500 000 so'm");
    expect(text).toContain("➕ 2%: 0 — davomat 76% (80% dan past)");
    expect(text).toContain("💰 To'lanadi: 7 500 000 so'm");
  });
});
