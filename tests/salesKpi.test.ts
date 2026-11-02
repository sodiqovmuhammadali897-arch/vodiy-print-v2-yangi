import { describe, expect, it } from "vitest";
import { boostTips, computeKpi, daysLeft, DEFAULT_SALES_KPI, forecastPayout, monthProgress, planState, ratesFor, short } from "../src/lib/salesKpi";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { summarize, monthBefore, monthsWithData } = require("../meta-webhook/salesKpi");
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

describe("KPI forecast and tips", () => {
  const rates = { plan: 200_000_000, sales_rate: 7.5, collect_rate: 2 };
  const result = { salesBonus: 11_100_000, collectPotential: 1_740_000, collectBonus: 0, attendanceOk: true, amoOk: false, eligible: false, payout: 11_100_000, planPct: 74 };
  const row = { salesSum: 148_000_000, collectedSum: 87_000_000, rates, result, frozen: false };

  it("knows how far the month is", () => {
    expect(monthProgress("2026-11", "2026-11-15")).toBe(0.5);
    expect(monthProgress("2026-10", "2026-11-15")).toBe(1);
    expect(monthProgress("2026-12", "2026-11-15")).toBe(0);
    expect(daysLeft("2026-11", "2026-11-22")).toBe(8);
    expect(daysLeft("2026-10", "2026-11-22")).toBe(0);
  });

  it("forecasts the open month and keeps past ones", () => {
    expect(forecastPayout(row, 0.5)).toBe(22_200_000); // collect part locked
    expect(forecastPayout({ ...row, result: { ...result, eligible: true } }, 0.5)).toBe(22_200_000 + 3_480_000);
    expect(forecastPayout(row, 1)).toBe(11_100_000);
    expect(forecastPayout(row, 0.07)).toBe(11_100_000); // day 2: too early
    expect(forecastPayout({ ...row, frozen: true }, 0.5)).toBe(11_100_000);
  });

  it("rates the plan against the calendar", () => {
    expect(planState(74, 0.73)).toBe("on");
    expect(planState(62, 0.73)).toBe("behind");
    expect(planState(41, 0.73)).toBe("risk");
    expect(planState(101, 0.5)).toBe("done");
    expect(planState(null, 0.5)).toBe("none");
  });

  it("lists what raises the pay", () => {
    expect(boostTips({ ...row, debt: 22_500_000, attendanceOk: true, amoOk: false })).toEqual([
      { kind: "sales", amount: 52_000_000, gain: 3_900_000 },
      { kind: "debt", amount: 22_500_000, gain: 450_000 },
      { kind: "tasks", amount: 0, gain: 1_740_000 },
    ]);
    expect(boostTips({ ...row, salesSum: 250_000_000, debt: 0, attendanceOk: true, amoOk: true, result: { ...result, eligible: true } })).toEqual([{ kind: "sales", amount: 10_000_000, gain: 750_000 }]);
  });
});

describe("KPI server months", () => {
  it("covers every month with a manager's sale or payment", () => {
    const now = Date.parse("2026-11-02T10:00:00+05:00");
    const months = monthsWithData(
      {
        managers: [{ id: "m", name: "Maryam" }],
        orders: [
          { id: "a", manager_name: "maryam", order_date: "2026-07-03", status: "closed" },
          { id: "b", manager_name: "", order_date: "2025-12-01", status: "closed" },
          { id: "c", manager_name: "Maryam", order_date: "2026-09-09", status: "cancelled" },
        ],
        payments: [{ order_id: "a", payment_date: "2026-08-15" }],
      },
      now,
    );
    expect(months).toEqual(["2026-07", "2026-08", "2026-10", "2026-11"]);
  });
});

describe("KPI recount after payment", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { paidText } = require("../meta-webhook/bonus");
  const snapshot = { plan: 100e6, sales: 130.4e6, collected: 105.1e6, sales_rate: 7.5, collect_rate: 2, threshold: 80, attendance_pct: 86.7, amo_pct: 38.2, sales_bonus: 9_780_000, collect_bonus: 0, eligible: false, payout: 9_780_000 };
  it("pays only the difference once paid before", () => {
    expect(paidText({ month: "2026-10", snapshot })).toBe("✅ Oktyabr 2026 bonusingiz to'landi: 9 780 000 so'm");
    expect(paidText({ month: "2026-10", snapshot, paid_before: 1_148_183 })).toBe("✅ Oktyabr 2026 bonusingiz qayta hisoblandi va qo'shimcha 8 631 817 so'm to'landi (jami 9 780 000 so'm)");
    expect(reportText({ month: "2026-10", snapshot, paid_before: 1_148_183 })).toContain("Avval to'langan: 1 148 183 so'm · qo'shimcha: 8 631 817 so'm");
  });
});
