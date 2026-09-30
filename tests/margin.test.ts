import { describe, expect, it } from "vitest";
import { buildMarginRows, catalogCostLookup, orderOnlyKey, profitBreakdown, summarize } from "../src/lib/margin";
import type { Order, OrderCost, OrderProduct } from "../src/lib/types";

const order = (id: string, total: number, extra: Partial<Order> = {}) => ({ id, total_amount: total, status: "new", title: `Buyurtma ${id}`, ...extra }) as Order;
const line = (id: string, orderId: string, qty: number, price: number, extra: Partial<OrderProduct> = {}) =>
  ({ id, order_id: orderId, position: 0, product_name: "Flayer A5", quantity: qty, unit_price: price, total: qty * price, ...extra }) as OrderProduct;
const cost = (id: string, total: number): [string, OrderCost] => [id, { id, order_id: "", unit_cost: 0, total_cost: total, source: "manual" }];

describe("buildMarginRows", () => {
  it("spreads the order discount over lines so they add up to the order total", () => {
    // lines 1 000 000 + 500 000, order total after a 150 000 discount = 1 350 000
    const rows = buildMarginRows([order("o1", 1_350_000)], [line("a", "o1", 1000, 1000), line("b", "o1", 500, 1000)], new Map());
    expect(rows.map((r) => Math.round(r.revenue))).toEqual([900_000, 450_000]);
    expect(Math.round(rows.reduce((s, r) => s + r.revenue, 0))).toBe(1_350_000);
  });

  it("computes profit and margin only for lines with a typed cost", () => {
    const rows = buildMarginRows([order("o1", 1_140_000)], [line("a", "o1", 6000, 190)], new Map([cost("a", 708_000)]));
    expect(rows[0].profit).toBe(432_000);
    expect(rows[0].unitCost).toBe(118);
    expect(rows[0].margin).toBeCloseTo(37.89, 1);
    const empty = buildMarginRows([order("o1", 1_140_000)], [line("a", "o1", 6000, 190)], new Map());
    expect(empty[0].profit).toBeNull();
  });

  it("gives an order without lines one row of its own", () => {
    const rows = buildMarginRows([order("o2", 500_000)], [], new Map([cost(orderOnlyKey("o2"), 300_000)]));
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("order_o2");
    expect(rows[0].profit).toBe(200_000);
  });

  it("suggests the catalog cost for the line's quantity", () => {
    const lookup = catalogCostLookup([{ id: "p1", name: "Flayer A5" }], [{ id: "p1", cost_tiers: [{ min_qty: 1000, cost_price: 130 }, { min_qty: 5000, cost_price: 118 }] }]);
    const rows = buildMarginRows([order("o1", 1_140_000)], [line("a", "o1", 6000, 190)], new Map(), lookup);
    expect(rows[0].suggestion).toBe(118);
    const byId = buildMarginRows([order("o1", 400_000)], [line("a", "o1", 2000, 200, { product_name: "boshqa nom", catalog_product_id: "p1" })], new Map(), lookup);
    expect(byId[0].suggestion).toBe(130);
  });
});

describe("summarize and profitBreakdown", () => {
  const rows = buildMarginRows(
    [order("o1", 1_000_000), order("o2", 600_000)],
    [line("a", "o1", 1000, 1000), line("b", "o2", 600, 1000)],
    new Map([cost("a", 700_000)]),
  );
  const s = summarize(rows);

  it("counts missing costs separately", () => {
    expect(s).toMatchObject({ revenue: 1_600_000, cost: 700_000, costedLines: 1, missingLines: 1, missingRevenue: 600_000, profit: 300_000 });
    expect(s.margin).toBeCloseTo(30, 5);
  });

  it("does not subtract supplier and raw-material payments twice", () => {
    const b = profitBreakdown(s, [
      { amount: 200_000, category: "Ijara" },
      { amount: 500_000, category: "Ta'minotchiga to'lov" },
      { amount: 100_000, category: "Xomashyo" },
    ]);
    expect(b).toMatchObject({ mode: "margin", gross: 900_000, otherExpenses: 200_000, costExpenses: 600_000, net: 700_000 });
  });

  it("keeps the cash view while no cost is typed for the period", () => {
    const none = summarize(buildMarginRows([order("o1", 1_000_000)], [line("a", "o1", 1000, 1000)], new Map()));
    const b = profitBreakdown(none, [{ amount: 300_000, category: "Ta'minotchiga to'lov" }]);
    expect(b).toMatchObject({ mode: "cash", net: 700_000 });
  });
});
