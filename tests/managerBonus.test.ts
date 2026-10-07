import { describe, expect, it } from "vitest";
import { computeBonus, DEFAULT_BONUS_SETTINGS, goalPlan, managerOrders, monthWorkDays, planScore, short, suggestPct, taskScore } from "../src/lib/managerBonus";
import type { Order } from "../src/lib/types";

const W = DEFAULT_BONUS_SETTINGS.weights;

describe("manager bonus", () => {
  it("suggests a share of the order from its margin", () => {
    expect(suggestPct(45)).toBe(12);
    expect(suggestPct(30)).toBe(10);
    expect(suggestPct(29.9)).toBe(7);
    expect(suggestPct(5)).toBe(5);
    expect(suggestPct(-10)).toBe(5);
    expect(suggestPct(null)).toBeNull();
  });

  it("scores the plan with a floor and a cap", () => {
    expect(planScore(82e6, 100e6, 60, 120)).toBeCloseTo(82);
    expect(planScore(55e6, 100e6, 60, 120)).toBe(0);
    expect(planScore(150e6, 100e6, 60, 120)).toBe(120);
    expect(planScore(10e6, 0, 60, 120)).toBeNull();
  });

  it("works out the owner's example: 5 mln fund, 84.75 % → 4 237 500", () => {
    const r = computeBonus(5_000_000, { plan: 82, tasks: 90, attendance: 95, crm: 70 }, W);
    expect(r.points).toEqual({ plan: 41, tasks: 22.5, attendance: 14.25, crm: 7 });
    expect(r.total).toBe(84.75);
    expect(r.payout).toBe(4_237_500);
    expect(r.missing).toEqual([]);
  });

  it("leaves out parts with no data and scales the rest", () => {
    // CRM not marked yet: 41 + 22.5 + 14.25 out of 90.
    const r = computeBonus(5_000_000, { plan: 82, tasks: 90, attendance: 95, crm: null }, W);
    expect(r.missing).toEqual(["crm"]);
    expect(r.total).toBeCloseTo(86.39, 2);
    expect(r.payout).toBe(4_319_400);
    expect(computeBonus(1_000_000, { plan: 0, tasks: 100, attendance: 100, crm: 100 }, W).payout).toBe(500_000);
  });

  it("counts tasks of the month, on time or not", () => {
    const t = (due: string | null, status: "done" | "new", completed: string | null, created = "2026-10-01T05:00:00Z") =>
      ({ due_date: due, status, completed_at: completed, created_at: created }) as never;
    const r = taskScore(
      [
        t("2026-10-03", "done", "2026-10-03T10:00:00Z"), // on time
        t("2026-10-04", "done", "2026-10-06T10:00:00Z"), // late
        t("2026-10-05", "new", null), // overdue
        t("2026-10-20", "new", null), // not due yet: skipped
        t("2026-09-28", "done", "2026-09-28T10:00:00Z"), // last month: skipped
        t(null, "done", "2026-10-02T10:00:00Z"), // no due date, done this month
        t(null, "new", null), // no due date, open: skipped
      ],
      "2026-10",
      "2026-10-06",
    );
    expect(r).toEqual({ total: 4, onTime: 2, late: 2, score: 50 });
    expect(taskScore([], "2026-10", "2026-10-06").score).toBeNull();
  });

  it("picks a manager's sale orders of a month by the order's day", () => {
    const o = (id: string, extra: Partial<Order>) => ({ id, status: "new", manager_name: "Maryam", total_amount: 1, ...extra }) as Order;
    const list = managerOrders(
      [
        o("a", { order_date: "2026-10-02" }),
        o("b", { order_date: "2026-09-30" }),
        o("c", { order_date: "2026-10-03", status: "cancelled" }),
        o("d", { order_date: "2026-10-04", manager_name: " maryam " }),
        o("e", { order_date: "2026-10-04", manager_name: "Dilmurod" }),
        o("f", { order_date: "2026-10-05", is_draft: true }),
      ],
      "Maryam",
      "2026-10",
    );
    expect(list.map((x) => x.id)).toEqual(["a", "d"]);
  });
});

describe("goal calculator", () => {
  const base = {
    goal: 10_000_000,
    rate: 5,
    scores: { plan: 25, tasks: 80, attendance: 82, crm: 70 },
    weights: W,
    turnover: 38e6,
    workDays: 26,
    daysDone: 6,
    avgCheck: 3.7e6,
    conversion: 20,
  };

  it("works out the turnover a goal takes", () => {
    const g = goalPlan(base)!;
    // KPI with the plan met: 50 + 20 + 12.3 + 7 = 89.3 %.
    expect(g.kpi).toBeCloseTo(89.3, 1);
    expect(g.required / 1e6).toBeCloseTo(224, 0);
    expect(g.left / 1e6).toBeCloseTo(186, 0);
    expect(g.expectedByNow / 1e6).toBeCloseTo(51.7, 1);
    expect(g.gap).toBeLessThan(0);
    expect(g.perDay! / 1e6).toBeCloseTo(9.3, 1);
    expect(g.orders).toBe(51);
    expect(g.leads).toBe(255);
    expect(g.allPerfect / 1e6).toBeCloseTo(200, 0);
    expect(g.gains.map((x) => x.key)).toEqual(["tasks", "crm", "attendance"]);
    expect(g.gains[0].saves / 1e6).toBeCloseTo(11.9, 1);
  });

  it("needs a goal and a rate", () => {
    expect(goalPlan({ ...base, goal: 0 })).toBeNull();
    expect(goalPlan({ ...base, rate: 0 })).toBeNull();
    expect(goalPlan({ ...base, avgCheck: null })!.orders).toBeNull();
  });

  it("counts working days of a month", () => {
    // October 2026: 31 days, 4 Sundays → 27 working days; before the 7th: 1–6 minus Sunday the 4th.
    expect(monthWorkDays("2026-10", "2026-10-07", [0])).toEqual({ total: 27, done: 5 });
    expect(short(224e6)).toBe("224 mln");
    expect(short(9.3e6)).toBe("9,3 mln");
    expect(short(850_000)).toBe("850 ming");
  });
});
