import type { CostTier, PriceTier } from "./types";

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

// Same tier-selection logic as tierPriceFor, applied to cost price instead
// of sale price — the supplier's per-unit cost usually drops with volume
// too, so cost is tiered by the same min_qty breakpoints.
export const tierCostFor = (tiers: CostTier[], quantity: number): number => {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let cost = sorted[0]?.cost_price ?? 0;
  for (const t of sorted) {
    if (quantity >= t.min_qty) cost = t.cost_price;
    else break;
  }
  return cost;
};

export const sortTiers = <T extends { min_qty: number }>(tiers: T[]): T[] =>
  [...tiers].sort((a, b) => a.min_qty - b.min_qty);
