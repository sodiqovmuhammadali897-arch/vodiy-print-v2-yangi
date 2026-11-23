import { describe, expect, it } from "vitest";
import { regionProblem } from "../src/lib/orderRegion";
import { salesOf } from "../src/lib/financeDash";
import type { Order } from "../src/lib/types";

describe("regionProblem", () => {
  const n = { asDraft: false, isNew: true, wasDraft: false };
  it("blocks a new order without a customer or region", () => {
    expect(regionProblem(null, n)).toMatch(/Mijozni tanlang/);
    expect(regionProblem({ region: " " }, n)).toMatch(/viloyat/);
    expect(regionProblem({ region: "Farg'ona" }, n)).toBeNull();
  });
  it("lets drafts and old orders through", () => {
    expect(regionProblem(null, { ...n, asDraft: true })).toBeNull();
    expect(regionProblem({ region: "" }, { asDraft: false, isNew: false, wasDraft: false })).toBeNull();
    expect(regionProblem({ region: "" }, { asDraft: false, isNew: false, wasDraft: true })).toMatch(/viloyat/);
  });
});

describe("salesOf", () => {
  const o = (id: string, customer_id: string, order_date: string, extra: Partial<Order> = {}) =>
    ({ id, customer_id, order_date, status: "new", is_draft: false, total_amount: 100, created_at: order_date, ...extra }) as unknown as Order;
  it("groups the period's sales of the given customers, newest first", () => {
    const m = salesOf(
      [o("a", "c1", "2026-11-02"), o("b", "c1", "2026-11-10"), o("c", "c1", "2026-10-01"), o("d", "c2", "2026-11-05"), o("e", "c1", "2026-11-06", { status: "cancelled" })],
      { from: "2026-11-01", to: "2026-11-30" },
      ["c1"],
    );
    expect([...m.keys()]).toEqual(["c1"]);
    expect(m.get("c1")!.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
