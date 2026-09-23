import { describe, expect, it } from "vitest";
import { computeOrderTotals, computeProductTotal } from "../src/lib/orderCalculations";

describe("computeProductTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeProductTotal({ quantity: 200, unit_price: 7900, discount: 0 })).toBe(1_580_000);
  });

  it("subtracts the line discount", () => {
    expect(computeProductTotal({ quantity: 10, unit_price: 5000, discount: 5000 })).toBe(45_000);
  });

  it("never goes below zero when the discount exceeds the line value", () => {
    expect(computeProductTotal({ quantity: 1, unit_price: 1000, discount: 5000 })).toBe(0);
  });

  it("treats missing numbers as zero instead of producing NaN", () => {
    expect(
      computeProductTotal({ quantity: undefined as unknown as number, unit_price: 1000, discount: 0 }),
    ).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("computes subtotal, total, paid and remaining debt", () => {
    const totals = computeOrderTotals(
      [{ total: 1_580_000 }, { total: 420_000 }],
      100_000,
      [{ amount: 1_000_000 }, { amount: 0 }],
    );
    expect(totals).toEqual({
      subtotal: 2_000_000,
      discount: 100_000,
      total: 1_900_000,
      paid: 1_000_000,
      remaining: 900_000,
    });
  });

  it("shows the 200 × 7 900 order with a 1 000 000 payment as 580 000 owed", () => {
    const line = computeProductTotal({ quantity: 200, unit_price: 7900, discount: 0 });
    expect(computeOrderTotals([{ total: line }], 0, [{ amount: 1_000_000 }]).remaining).toBe(580_000);
  });

  it("never reports negative debt when a customer overpays", () => {
    const totals = computeOrderTotals([{ total: 500_000 }], 0, [{ amount: 600_000 }]);
    expect(totals.remaining).toBe(0);
    expect(totals.paid).toBe(600_000);
  });

  it("never reports a negative total when the order discount exceeds the subtotal", () => {
    expect(computeOrderTotals([{ total: 100_000 }], 150_000, []).total).toBe(0);
  });

  it("handles an order with no products or payments", () => {
    expect(computeOrderTotals([], 0, [])).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
      paid: 0,
      remaining: 0,
    });
  });
});
