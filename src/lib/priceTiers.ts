import type { PriceTier } from "./types";

// Picks the applicable price for a quantity: the highest tier whose
// min_qty does not exceed the quantity. Falls back to the lowest tier
// (or 0) if quantity is below every tier's threshold.
export const tierPriceFor = (tiers: PriceTier[], quantity: number): number => {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let price = sorted[0]?.price ?? 0;
  for (const t of sorted) {
    if (quantity >= t.min_qty) price = t.price;
    else break;
  }
  return price;
};

export const sortTiers = (tiers: PriceTier[]): PriceTier[] =>
  [...tiers].sort((a, b) => a.min_qty - b.min_qty);
