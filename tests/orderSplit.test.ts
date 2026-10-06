import { describe, expect, it } from "vitest";
import { shareOut, splitOrder } from "../src/lib/orderSplit";
import type { OrderPayload, WizardPayment, WizardProduct } from "../src/lib/orderService";

const line = (name: string, total: number) => ({ product_name: name, total, quantity: 1, unit_price: total, position: 3 }) as WizardProduct;
const pay = (amount: number) => ({ amount, payment_type: "Naqd", payment_date: "2026-10-06", received_by: "", note: "" }) as WizardPayment;
const payload = { title: "Buyurtma", customer_id: "c1", brand_id: "b1", discount_amount: 0, delivery_cost: 50000, order_number: null } as unknown as OrderPayload;

describe("splitting one order into one per product", () => {
  it("shares whole amounts and keeps the sum", () => {
    expect(shareOut(100, [1, 1, 1])).toEqual([33, 33, 34]);
    expect(shareOut(0, [5, 5])).toEqual([0, 0]);
    expect(shareOut(70, [0, 0])).toEqual([70, 0]);
  });

  it("keeps a single product as it is", () => {
    const parts = splitOrder(payload, [line("Paket", 100)], [pay(40)]);
    expect(parts).toHaveLength(1);
    expect(parts[0].payload).toBe(payload);
  });

  it("gives each product its own order for the same customer", () => {
    const parts = splitOrder(
      { ...payload, discount_amount: 300 },
      [line("Paket 43", 6000), line("Papka standart", 3000), line("Vizitka", 1000)],
      [pay(5000), pay(0)],
    );
    expect(parts.map((p) => p.payload.title)).toEqual(["Paket 43", "Papka standart", "Vizitka"]);
    expect(parts.every((p) => p.payload.customer_id === "c1" && p.payload.brand_id === "b1")).toBe(true);
    expect(parts.map((p) => p.products.length)).toEqual([1, 1, 1]);
    expect(parts.every((p) => p.products[0].position === 0)).toBe(true);
    // Discount by sum: 180 / 90 / 30.
    expect(parts.map((p) => p.payload.discount_amount)).toEqual([180, 90, 30]);
    // Delivery once.
    expect(parts.map((p) => p.payload.delivery_cost)).toEqual([50000, 0, 0]);
    // Payment by what is owed: 5820 / 2910 / 970 of 9700 → 3000 / 1500 / 500.
    const paid = parts.map((p) => p.payments.reduce((s, x) => s + x.amount, 0));
    expect(paid).toEqual([3000, 1500, 500]);
    expect(parts.every((p) => p.payments.every((x) => x.amount > 0))).toBe(true);
  });
});
