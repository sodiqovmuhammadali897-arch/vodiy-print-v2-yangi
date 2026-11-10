// Gift box (the owner's request, 2026-11-10): a gift box is bought ready
// at the market (170–200 ming) and we print the logo on what is inside —
// a pen, a leather notebook, a mug … each at its own print price.
//   cost of one box = market price + Σ (items × their print price)
//   price to the customer = cost + the markup for that quantity (admin's
//   table, e.g. 10–20 dona +30%), rounded up (1 000 so'm by default).
// The admin keeps the costs and the markup (giftbox_settings/main and
// giftbox_costs/{typeId}, admin-only). Managers read only giftbox_types:
// the type's name, its usual items and a ready price table — the sale-price
// part of the box and of each item per quantity tier — so the price comes
// out without the cost or the markup ever reaching a manager's device.
import type { CostTier } from "./types";

export type GiftboxPrint = { name: string; cost: number }; // logo print, per item
export type MarkupTier = { min: number; markup: number }; // from `min` pieces up, +markup %
export type GiftboxSettings = { prints: GiftboxPrint[]; tiers: MarkupTier[]; round: number; updated_at?: string };
export type GiftboxItem = { name: string; qty: number };
export type PriceRow = { min: number; box: number; items: Record<string, number> };
export type GiftboxType = {
  id: string;
  name: string;
  items: GiftboxItem[]; // what is usually inside
  active: boolean;
  prices: PriceRow[]; // sale-price parts per tier — no cost, no markup
  round: number;
  updated_at?: string;
};
export type GiftboxCost = { id: string; box_cost: number; updated_at?: string }; // admin only
export type LineGiftbox = { type_id: string; items: GiftboxItem[] }; // on an order line

export const DEFAULT_ROUND = 1000;
const norm = (s: string) => String(s || "").trim().toLowerCase();

// One box's cost: the market price plus every item's print price.
export function unitCost(boxCost: number, items: GiftboxItem[], prints: GiftboxPrint[]): number {
  const by = new Map(prints.map((p) => [norm(p.name), Number(p.cost) || 0]));
  return Number(boxCost || 0) + items.reduce((s, it) => s + (Number(it.qty) || 0) * (by.get(norm(it.name)) || 0), 0);
}

export const sortTiers = (tiers: MarkupTier[]) => [...tiers].filter((t) => Number(t.min) > 0).sort((a, b) => a.min - b.min);
// The tier a quantity falls in (below the first: the first).
export function tierFor<T extends { min: number }>(rows: T[], qty: number): T | null {
  const sorted = [...rows].sort((a, b) => a.min - b.min);
  if (!sorted.length) return null;
  return [...sorted].reverse().find((r) => qty >= r.min) || sorted[0];
}

// The table managers read: per tier, the sale-price part of the box and of
// each printable item (cost × (1 + markup)).
export function priceTable(boxCost: number, prints: GiftboxPrint[], tiers: MarkupTier[]): PriceRow[] {
  return sortTiers(tiers).map((t) => {
    const k = 1 + (Number(t.markup) || 0) / 100;
    return { min: t.min, box: Number(boxCost || 0) * k, items: Object.fromEntries(prints.filter((p) => p.name.trim()).map((p) => [norm(p.name), (Number(p.cost) || 0) * k])) };
  });
}

export const roundUp = (v: number, step: number) => (step > 0 ? Math.ceil(Math.round(v) / step) * step : Math.round(v));

// The price of one box for this quantity and these items; null when the
// admin hasn't set the markup yet.
export function priceFor(type: Pick<GiftboxType, "prices" | "round">, qty: number, items: GiftboxItem[]): number | null {
  const row = tierFor(type.prices || [], qty);
  if (!row) return null;
  const raw = row.box + items.reduce((s, it) => s + (Number(it.qty) || 0) * (row.items[norm(it.name)] || 0), 0);
  return roundUp(raw, type.round ?? DEFAULT_ROUND);
}

// What a manager can add to a box: every item that has a print price.
export const printableItems = (type: Pick<GiftboxType, "prices">) => Object.keys((type.prices && type.prices[0] && type.prices[0].items) || {});

// "ruchka ×1, koja bloknot ×1" — for the line's variant field.
export const itemsLabel = (items: GiftboxItem[]) => items.filter((i) => i.qty > 0).map((i) => (i.qty === 1 ? i.name : `${i.name} ×${i.qty}`)).join(", ");

// The gift box offer's note, written for the manager (they may edit it).
export const offerNote = (items: GiftboxItem[]) => {
  const list = itemsLabel(items);
  return [
    "Gift box ichidagi barcha narsalarga logotipingiz UV printer orqali tushiriladi — o'chib ketmaydi.",
    list ? `To'plam: ${list}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

// The Marja page's suggestion for a gift box line: one box's cost.
export function giftboxCostLookup(costs: GiftboxCost[], settings: GiftboxSettings | null) {
  const box = new Map(costs.map((c) => [c.id, Number(c.box_cost) || 0]));
  return (line: { giftbox?: LineGiftbox | null }): CostTier[] | null => {
    const g = line.giftbox;
    if (!g || !box.has(g.type_id)) return null;
    return [{ min_qty: 1, cost_price: unitCost(box.get(g.type_id)!, g.items || [], settings?.prints || []) }];
  };
}
