// Gift box and souvenirs (the owner's requests, 2026-11-10/11): a gift box is bought ready
// at the market (170–200 ming) and we print the logo on what is inside —
// a pen, a leather notebook, a mug … each at its own print price.
//   cost of one box = market price + Σ items × (their buy price + print price)
//   (buy price 0 when the item comes inside the box)
//   a souvenir on its own: cost = buy price + print price (no logo: buy only),
//   price = cost + the souvenir markup for that quantity (its own table)
//   price to the customer = cost + the markup for that quantity (admin's
//   table, e.g. 10–30 dona +30%), rounded up (1 000 so'm by default).
// The manager types the box's name and market price and ticks the items;
// the system prices it. The admin keeps the print prices and the markup in
// giftbox_settings/main (admin-only). Managers read giftbox_prices/main: per
// quantity tier, the box multiplier and each item's sale-price part — no
// print price or markup is written out on their screen.
import type { CostTier } from "./types";

// Per item: `cost` = the logo print, `buy` = what the item itself costs us.
export type GiftboxPrint = { name: string; cost: number; buy?: number };
export type MarkupTier = { min: number; markup: number }; // from `min` pieces up, +markup %
export type GiftboxSettings = { prints: GiftboxPrint[]; tiers: MarkupTier[]; souvenir_tiers?: MarkupTier[]; round: number; updated_at?: string };
export type GiftboxItem = { name: string; qty: number };
export type PriceRow = { min: number; k: number; items: Record<string, number> };
// Souvenir rows: per item the sale price with the logo and without it.
export type SouvenirRow = { min: number; k: number; logo: Record<string, number>; plain: Record<string, number> };
export type GiftboxPrices = { rows: PriceRow[]; names: string[]; round: number; souvenir?: SouvenirRow[]; updated_at?: string };
// On a souvenir order line: which item, with the logo or not.
export type LineSouvenir = { name: string; logo: boolean };
// On an order line / an offer: what the manager typed and ticked.
export type LineGiftbox = { name?: string; box_cost?: number; items: GiftboxItem[] };

export const DEFAULT_ROUND = 1000;
const norm = (s: string) => String(s || "").trim().toLowerCase();

// One item's cost to us: what it costs plus the logo print.
const itemCost = (p: GiftboxPrint) => (Number(p.buy) || 0) + (Number(p.cost) || 0);

// One box's cost: the market price plus every item (its price and print).
export function unitCost(boxCost: number, items: GiftboxItem[], prints: GiftboxPrint[]): number {
  const by = new Map(prints.map((p) => [norm(p.name), itemCost(p)]));
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
export function publicPrices(prints: GiftboxPrint[], tiers: MarkupTier[], round: number, souvenirTiers: MarkupTier[] = []): GiftboxPrices {
  const named = prints.filter((p) => p.name.trim());
  const kOf = (t: MarkupTier) => 1 + (Number(t.markup) || 0) / 100;
  return {
    rows: sortTiers(tiers).map((t) => {
      const k = kOf(t);
      return { min: t.min, k, items: Object.fromEntries(named.map((p) => [norm(p.name), itemCost(p) * k])) };
    }),
    names: named.map((p) => p.name.trim()),
    round,
    souvenir: sortTiers(souvenirTiers).map((t) => {
      const k = kOf(t);
      return {
        min: t.min,
        k,
        logo: Object.fromEntries(named.map((p) => [norm(p.name), itemCost(p) * k])),
        plain: Object.fromEntries(named.map((p) => [norm(p.name), (Number(p.buy) || 0) * k])),
      };
    }),
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

// One souvenir's price for this quantity; null when the souvenir markup or
// the item's price isn't set.
export function souvenirPrice(table: Pick<GiftboxPrices, "souvenir" | "round"> | null, qty: number, item: LineSouvenir): number | null {
  const row = table ? tierFor(table.souvenir || [], qty) : null;
  if (!row) return null;
  const v = (item.logo ? row.logo : row.plain)[norm(item.name)];
  if (!(v > 0)) return null;
  return roundUp(v, table!.round ?? DEFAULT_ROUND);
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
  return (line: { giftbox?: LineGiftbox | null; souvenir?: LineSouvenir | null }): CostTier[] | null => {
    const sv = line.souvenir;
    if (sv && sv.name) {
      const p = (settings?.prints || []).find((x) => norm(x.name) === norm(sv.name));
      if (!p) return null;
      const cost = (Number(p.buy) || 0) + (sv.logo ? Number(p.cost) || 0 : 0);
      return cost > 0 ? [{ min_qty: 1, cost_price: cost }] : null;
    }
    const g = line.giftbox;
    if (!g || !(Number(g.box_cost) > 0)) return null;
    return [{ min_qty: 1, cost_price: unitCost(Number(g.box_cost), g.items || [], settings?.prints || []) }];
  };
}
