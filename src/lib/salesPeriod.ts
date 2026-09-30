import type { Order } from "./types";

// One rule for which orders count as sales and in which day/month, shared
// by Bosh sahifa, Hisobot, Moliya and Marja so their totals agree: the
// order's own date (the Sana field of the order form), else the day it was
// entered (Tashkent time); cancelled orders and drafts don't count.
const TZ_MS = 5 * 3600 * 1000;
export const tashkentDay = (iso: string | null | undefined) =>
  iso ? new Date(Date.parse(iso) + TZ_MS).toISOString().slice(0, 10) : "";

export const saleDay = (o: Pick<Order, "order_date" | "created_at">): string =>
  o.order_date ? String(o.order_date).slice(0, 10) : tashkentDay(o.created_at);

export const isSale = (o: Pick<Order, "status" | "is_draft">): boolean => o.status !== "cancelled" && !o.is_draft;

export const currentMonth = (now = new Date()) => tashkentDay(now.toISOString()).slice(0, 7);
