import { describe, expect, it } from "vitest";
import { debtView, groupOfStatus, periodRange } from "../src/lib/debts";
import type { Order } from "../src/lib/types";

const o = (id: string, status: string, manager: string, day: string, total: number, paid = 0, extra = {}) =>
  ({ id, status, manager_name: manager, order_date: day, created_at: `${day}T10:00:00Z`, total_amount: total, paid_amount: paid, remaining_amount: 0, is_draft: false, ...extra }) as unknown as Order;

const orders = [
  o("a", "production", "Muhammadiyor", "2026-10-21", 10e6),
  o("b", "new", "Muhammadali", "2026-11-02", 7e6, 1e6),
  o("c", "delivered", "Muhammadiyor", "2026-10-03", 5e6, 1e6),
  o("d", "ready_to_deliver", " Maryam ", "2026-09-10", 3e6),
  o("e", "closed", "", "2026-11-04", 2e6),
  o("f", "delivered", "Nuriddin", "2026-11-03", 4e6, 4e6), // paid
  o("g", "cancelled", "Nuriddin", "2026-11-03", 9e6), // cancelled
  o("h", "new", "Nuriddin", "2026-11-03", 9e6, 0, { is_draft: true }), // draft
];
const today = "2026-11-05";

describe("Qarzdorlik", () => {
  it("puts statuses into four steps", () => {
    expect(["design", "sent_to_production", "ready", "closed", "approving"].map(groupOfStatus)).toEqual(["new", "production", "ready", "delivered", "new"]);
  });

  it("knows each period", () => {
    expect(periodRange("all", today)).toBeNull();
    expect(periodRange("week", today)).toEqual({ from: "2026-10-30", to: today });
    expect(periodRange("month", today)).toEqual({ from: "2026-11-01", to: today });
    expect(periodRange("last_month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("year", today)).toEqual({ from: "2026-01-01", to: today });
  });

  it("sums unpaid orders by status and manager", () => {
    const v = debtView(orders, { period: "all", group: "all", manager: null, today });
    expect(v.total).toEqual({ n: 5, sum: 10e6 + 6e6 + 4e6 + 3e6 + 2e6 });
    expect(v.rows.map((r) => r.order.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(v.byGroup.delivered).toEqual({ n: 2, sum: 6e6 });
    expect(v.byManager).toEqual([
      { name: "Muhammadiyor", n: 2, sum: 14e6 },
      { name: "Muhammadali", n: 1, sum: 6e6 },
      { name: "Maryam", n: 1, sum: 3e6 },
      { name: "Menejersiz", n: 1, sum: 2e6 },
    ]);
  });

  it("filters by period, status and manager", () => {
    expect(debtView(orders, { period: "month", group: "all", manager: null, today }).rows.map((r) => r.order.id)).toEqual(["b", "e"]);
    expect(debtView(orders, { period: "last_month", group: "all", manager: null, today }).total.sum).toBe(14e6);
    const v = debtView(orders, { period: "all", group: "delivered", manager: "Muhammadiyor", today });
    expect(v.rows.map((r) => r.order.id)).toEqual(["c"]);
    expect(v.byGroup.all).toEqual({ n: 2, sum: 14e6 }); // the cards show the manager's whole debt
    expect(v.byManager.map((m) => m.name)).toEqual(["Muhammadiyor", "Menejersiz"]); // managers with delivered debt
  });
});
