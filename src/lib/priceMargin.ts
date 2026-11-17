// Product price tiers: price from cost and margin, and back (the owner,
// 2026-11-17: «marjani yozsam avtomatik o'zi sotuv narxini chiqsin»).
// Margin is profit as a share of the SALE price — the same as the Marja
// page (src/lib/margin.ts) — not a markup on cost: cost 4 300 at 35 % →
// 4 300 / 0.65 = 6 615 → 6 700 (rounded UP to `step` so'm).

export const PRICE_STEP = 100;

export function priceFromMargin(cost: number, marginPct: number, step = PRICE_STEP): number | null {
  if (!(cost > 0) || !Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100) return null;
  const raw = cost / (1 - marginPct / 100);
  return Math.ceil(Math.round(raw * 100) / 100 / step) * step;
}

// The margin a price gives, to one decimal (null when it can't be told).
export function marginOf(cost: number, price: number): number | null {
  if (!(cost > 0) || !(price > 0)) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

// "35", "33,3", "-5" — how a margin shows in the field.
export const marginLabel = (m: number | null) => (m === null ? "" : String(m).replace(".", ","));

// What the field holds → a number ("33,3" and "33.3" both work).
export const parseMargin = (s: string) => {
  const n = Number(String(s).replace(",", ".").replace(/[^\d.-]/g, ""));
  return String(s).trim() === "" || !Number.isFinite(n) ? null : n;
};
