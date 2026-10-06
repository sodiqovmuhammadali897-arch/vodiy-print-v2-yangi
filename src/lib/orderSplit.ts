import type { OrderPayload, WizardPayment, WizardProduct } from "./orderService";

// Several products typed into one new order become one order each: own
// VP number, own line in Buyurtmalar, own status — the same customer,
// brand, manager and dates. The order-level discount and the payments
// are shared out by each product's sum (whole so'm, the remainder on the
// last one), so the totals of the parts add up to the order as typed.
// Delivery is charged once, on the first.

export type OrderPart = { payload: OrderPayload; products: WizardProduct[]; payments: WizardPayment[] };

// Splits `amount` by `weights`; parts are whole numbers summing to `amount`.
export const shareOut = (amount: number, weights: number[]): number[] => {
  const sum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? amount : 0));
  const parts = weights.map((w) => Math.round((amount * Math.max(0, w)) / sum));
  parts[parts.length - 1] += amount - parts.reduce((s, p) => s + p, 0);
  return parts;
};

export const splitOrder = (payload: OrderPayload, products: WizardProduct[], payments: WizardPayment[]): OrderPart[] => {
  if (products.length <= 1) return [{ payload, products, payments }];
  const lineTotals = products.map((p) => Number(p.total || 0));
  const discounts = shareOut(Number(payload.discount_amount || 0), lineTotals);
  const orderTotals = lineTotals.map((t, i) => Math.max(0, t - discounts[i]));
  const paymentParts = payments.map((p) => shareOut(Number(p.amount || 0), orderTotals));
  return products.map((product, i) => ({
    payload: {
      ...payload,
      title: product.product_name.trim() || payload.title,
      discount_amount: discounts[i],
      delivery_cost: i === 0 ? payload.delivery_cost : 0,
    },
    products: [{ ...product, position: 0 }],
    payments: payments.map((p, j) => ({ ...p, amount: paymentParts[j][i] })).filter((p) => p.amount > 0),
  }));
};
