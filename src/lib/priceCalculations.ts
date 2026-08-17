import type { CostTier, PriceTier } from "./types";
import { tierCostFor, tierPriceFor } from "./priceTiers";

export const marginPercent = (salePrice: number, costPrice: number): number => {
  if (costPrice <= 0) return 0;
  return ((salePrice - costPrice) / costPrice) * 100;
};

export type TierBreakdownRow = {
  min_qty: number;
  unit_price: number;
  unit_cost: number | null; // null when the caller has no cost visibility
  total_price: number;
  total_cost: number | null;
  profit: number | null;
  margin: number | null;
};

// One row per price tier, each priced as if `quantity` units were bought at
// that tier's own min_qty (i.e. the tier's own unit price/cost) — this is
// what the pricing table shows regardless of the quantity actually typed
// into the calculator.
export const buildTierRows = (
  priceTiers: PriceTier[],
  costTiers: CostTier[] | null,
): TierBreakdownRow[] => {
  const sorted = [...priceTiers].sort((a, b) => a.min_qty - b.min_qty);
  return sorted.map((t) => {
    const unit_cost = costTiers ? tierCostFor(costTiers, t.min_qty) : null;
    const total_price = t.price * t.min_qty;
    const total_cost = unit_cost !== null ? unit_cost * t.min_qty : null;
    return {
      min_qty: t.min_qty,
      unit_price: t.price,
      unit_cost,
      total_price,
      total_cost,
      profit: unit_cost !== null ? total_price - total_cost! : null,
      margin: unit_cost !== null ? marginPercent(t.price, unit_cost) : null,
    };
  });
};

export type QuantityQuote = {
  unitPrice: number;
  unitCost: number | null;
  totalPrice: number;
  totalCost: number | null;
  profit: number | null;
  margin: number | null;
};

// The "tiraj kiritilganda avtomatik hisoblaydi" calculator: resolves the
// applicable tier for an arbitrary typed-in quantity and derives every
// downstream number from it.
export const quoteForQuantity = (
  priceTiers: PriceTier[],
  costTiers: CostTier[] | null,
  quantity: number,
): QuantityQuote => {
  const unitPrice = tierPriceFor(priceTiers, quantity);
  const unitCost = costTiers ? tierCostFor(costTiers, quantity) : null;
  const totalPrice = unitPrice * quantity;
  const totalCost = unitCost !== null ? unitCost * quantity : null;
  return {
    unitPrice,
    unitCost,
    totalPrice,
    totalCost,
    profit: unitCost !== null ? totalPrice - totalCost! : null,
    margin: unitCost !== null ? marginPercent(unitPrice, unitCost) : null,
  };
};
