import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("../meta-webhook/recall");

const today = "2026-11-02";
const cust = (id: string, extra: Record<string, unknown> = {}) => ({ id, first_name: id, phone: "+998901234567", ...extra });
const order = (id: string, customer_id: string, order_date: string, extra: Record<string, unknown> = {}) => ({ id, customer_id, order_date, status: "closed", total_amount: 1_000_000, manager_id: "m1", ...extra });

describe("recall planDay", () => {
  const customers = ["a", "b", "c", "d", "e", "f", "g"].map((x) => cust(x));
  const orders = [
    order("o1", "a", "2025-08-10"),
    order("o2", "b", "2025-09-01", { manager_id: "m2" }),
    order("o3", "c", "2025-12-20"),
    order("o4", "d", "2026-10-01"), // bought a month ago: too recent
    order("o5", "e", "2026-01-15", { status: "production" }), // has an open order
    order("o6", "f", "2026-02-01"),
    order("o7", "g", "2026-03-01"),
  ];
  const stats = R.customerStats(orders, []);

  it("starts with the longest-silent customers and leaves out recent and open ones", () => {
    const { plan, waiting } = R.planDay({ customers, stats, calls: [], managerIds: ["m1", "m2"], today, perDay: 2 });
    expect(plan.m1).toEqual([{ customer_id: "a", why: "old" }, { customer_id: "c", why: "old" }]);
    expect(plan.m2).toEqual([{ customer_id: "b", why: "old" }, { customer_id: "f", why: "old" }]);
    expect(waiting).toBe(1); // g
  });

  it("skips customers without a phone", () => {
    const noPhone = customers.map((c) => (c.id === "a" ? { ...c, phone: "" } : c));
    const { plan } = R.planDay({ customers: noPhone, stats, calls: [], managerIds: ["m1"], today, perDay: 1 });
    expect(plan.m1[0].customer_id).toBe("b");
  });

  it("brings back unmarked, no-answer and later ones to the same manager first", () => {
    const calls = [
      { id: "1", customer_id: "g", day: "2026-10-31", status: "sent", manager_id: "m2" },
      { id: "2", customer_id: "f", day: "2026-10-30", status: "done", result: "noanswer", next_day: "2026-11-02", manager_id: "m2" },
      { id: "3", customer_id: "a", day: "2026-10-30", status: "done", result: "later", next_day: "2026-11-09", manager_id: "m1" },
      { id: "4", customer_id: "b", day: "2026-10-20", status: "done", result: "order", manager_id: "m2" },
      { id: "5", customer_id: "c", day: "2026-06-01", status: "done", result: "no", reason: "closed", manager_id: "m1" },
    ];
    const { plan } = R.planDay({ customers, stats, calls, managerIds: ["m1", "m2"], today, perDay: 2 });
    expect(plan.m2).toEqual([{ customer_id: "f", why: "noanswer" }, { customer_id: "g", why: "carry" }]);
    // a waits for its day, b talked 13 days ago, c is closed for good: none left
    expect(plan.m1).toEqual([]);
  });
});

describe("recall callState", () => {
  it("rests after a talk for 30 days and after «Kerak emas» for 90", () => {
    expect(R.callState({ day: "2026-10-10", status: "done", result: "order" }, today).kind).toBe("rest");
    expect(R.callState({ day: "2026-09-01", status: "done", result: "order" }, today).kind).toBe("free");
    expect(R.callState({ day: "2026-09-01", status: "done", result: "no", reason: "price" }, today).kind).toBe("rest");
    expect(R.callState({ day: "2026-07-01", status: "done", result: "no", reason: "price" }, today).kind).toBe("free");
  });
});

describe("recall texts", () => {
  it("shows the last purchase, the total and an offer", () => {
    const stats = R.customerStats(
      [order("o1", "a", "2025-08-10", { total_amount: 4_800_000 }), order("o0", "a", "2025-03-01", { total_amount: 6_400_000 })],
      [{ order_id: "o1", product_name: "Flayer", quantity: 1000 }, { order_id: "o1", product_name: "Katalog", quantity: 5 }],
    );
    const t = R.customerText({ id: "a", company: "Rahimov School", first_name: "Shahboz", phone: "+998900000000" }, stats.get("a"), 1, 5, today, "old");
    expect(t).toContain("1/5 · Rahimov School — Shahboz");
    expect(t).toContain("Oxirgi xarid: 15 oy oldin, avgust 2025");
    expect(t).toContain("Flayer 1000 dona, Katalog 5 dona — 4,8 mln");
    expect(t).toContain("Jami: 2 buyurtma · 11,2 mln");
    expect(t).toContain("yangi yil");
  });
});
