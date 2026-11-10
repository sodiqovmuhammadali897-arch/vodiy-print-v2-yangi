// Gift box (the owner's request, 2026-11-10): a gift box is bought ready
// at the market (170–200 ming) and we print the logo on what is inside —
// a pen, a leather notebook, a mug … each at its own print price.
//   cost of one box = market price + Σ (items × their print price)
//   price to the customer = cost + the markup for that quantity (admin's
//   table, e.g. 10–30 dona +30%), rounded up (1 000 so'm by default).
// The manager types the box's name and market price and ticks the items;
// the system prices it. The admin keeps the print prices and the markup in
// giftbox_settings/main (admin-only). Managers read giftbox_prices/main: per
// quantity tier, the box multiplier and each item's sale-price part — no
// print price or markup is written out on their screen.
import type { CostTier } from "./types";

export type GiftboxPrint = { name: string; cost: number }; // logo print, per item
export type MarkupTier = { min: number; markup: number }; // from `min` pieces up, +markup %
export type GiftboxSettings = { prints: GiftboxPrint[]; tiers: MarkupTier[]; round: number; updated_at?: string };
export type GiftboxItem = { name: string; qty: number };
export type PriceRow = { min: number; k: number; items: Record<string, number> };
export type GiftboxPrices = { rows: PriceRow[]; names: string[]; round: number; updated_at?: string };
// On an order line / an offer: what the manager typed and ticked.
export type LineGiftbox = { name?: string; box_cost?: number; items: GiftboxItem[] };

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

// The table managers read, written when the admin saves.
export function publicPrices(prints: GiftboxPrint[], tiers: MarkupTier[], round: number): GiftboxPrices {
  const named = prints.filter((p) => p.name.trim());
  return {
    rows: sortTiers(tiers).map((t) => {
      const k = 1 + (Number(t.markup) || 0) / 100;
      return { min: t.min, k, items: Object.fromEntries(named.map((p) => [norm(p.name), (Number(p.cost) || 0) * k])) };
    }),
    names: named.map((p) => p.name.trim()),
    round,
  };
}

export const roundUp = (v: number, step: number) => (step > 0 ? Math.ceil(Math.round(v) / step) * step : Math.round(v));

// One box's price for this quantity, market price and items; null when the
// admin hasn't set the markup table yet.
export function priceFor(table: Pick<GiftboxPrices, "rows" | "round"> | null, qty: number, boxCost: number, items: GiftboxItem[]): number | null {
  const row = table ? tierFor(table.rows || [], qty) : null;
  if (!row) return null;
  const raw = Number(boxCost || 0) * row.k + items.reduce((s, it) => s + (Number(it.qty) || 0) * (row.items[norm(it.name)] || 0), 0);
  return roundUp(raw, table!.round ?? DEFAULT_ROUND);
}

// "Ruchka, Koja bloknot ×2" — for the line's variant field.
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

// The Marja page's suggestion for a gift box line: one box's cost, from the
// market price the manager typed and the admin's print prices.
export function giftboxCostLookup(settings: GiftboxSettings | null) {
  return (line: { giftbox?: LineGiftbox | null }): CostTier[] | null => {
    const g = line.giftbox;
    if (!g || !(Number(g.box_cost) > 0)) return null;
    return [{ min_qty: 1, cost_price: unitCost(Number(g.box_cost), g.items || [], settings?.prints || []) }];
  };
}
