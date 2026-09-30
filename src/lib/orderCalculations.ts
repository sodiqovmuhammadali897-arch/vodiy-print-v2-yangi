import type { OrderProduct, OrderPayment } from "./types";

export const computeProductTotal = (p: {
  quantity: number;
  unit_price: number;
  discount: number;
}) => {
  const gross = Number(p.quantity || 0) * Number(p.unit_price || 0);
  return Math.max(0, gross - Number(p.discount || 0));
};

// How much of the order's list price (quantity × price) is given away as
// discounts — per line and on the whole order. Above LARGE_DISCOUNT it is
// most likely a paid amount or a total typed into a discount box.
export const LARGE_DISCOUNT = 30;
export const discountShare = (
  products: Pick<OrderProduct, "quantity" | "unit_price" | "discount">[],
  orderDiscount: number,
) => {
  const gross = products.reduce((s, p) => s + Number(p.quantity || 0) * Number(p.unit_price || 0), 0);
  const total = products.reduce((s, p) => s + Number(p.discount || 0), 0) + Number(orderDiscount || 0);
  const percent = gross > 0 ? (total / gross) * 100 : total > 0 ? 100 : 0;
  return { gross, total, percent, large: total > 0 && percent >= LARGE_DISCOUNT };
};

export const sumProducts = (products: Pick<OrderProduct, "total">[]) =>
  products.reduce((s, p) => s + Number(p.total || 0), 0);

export const sumPayments = (payments: Pick<OrderPayment, "amount">[]) =>
  payments.reduce((s, p) => s + Number(p.amount || 0), 0);

export type OrderTotals = {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
};

export const computeOrderTotals = (
  products: Pick<OrderProduct, "total">[],
  discount: number,
  payments: Pick<OrderPayment, "amount">[],
): OrderTotals => {
  const subtotal = sumProducts(products);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const paid = sumPayments(payments);
  return {
    subtotal,
    discount: Number(discount || 0),
    total,
    paid,
    remaining: Math.max(0, total - paid),
  };
};
