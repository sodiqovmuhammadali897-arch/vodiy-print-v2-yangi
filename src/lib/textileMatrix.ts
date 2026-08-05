import type { OrderProduct } from "./types";
import { TEXTILE_SIZES } from "./orderConstants";

export type TextileMatrixRow = {
  color: string;
  qty: Record<string, number>;
  total: number;
};

export type TextileMatrix = {
  rows: TextileMatrixRow[];
  sizeTotals: Record<string, number>;
  grandTotal: number;
};

// Merges every Textil-category line item's size_breakdown for an order into
// one color x size table — most orders have a single Textil line, but this
// stays correct if someone ever splits one order across several.
export const pivotTextileBreakdown = (products: OrderProduct[]): TextileMatrix => {
  const byColor = new Map<string, Record<string, number>>();
  for (const p of products) {
    if (p.category !== "Textil" || !Array.isArray(p.size_breakdown)) continue;
    for (const entry of p.size_breakdown) {
      if (!byColor.has(entry.color)) {
        byColor.set(
          entry.color,
          Object.fromEntries(TEXTILE_SIZES.map((s) => [s, 0])),
        );
      }
      const row = byColor.get(entry.color)!;
      if (TEXTILE_SIZES.includes(entry.size as (typeof TEXTILE_SIZES)[number])) {
        row[entry.size] = (row[entry.size] || 0) + Number(entry.qty || 0);
      }
    }
  }

  const sizeTotals = Object.fromEntries(TEXTILE_SIZES.map((s) => [s, 0]));
  const rows: TextileMatrixRow[] = [];
  for (const [color, qty] of byColor) {
    const total = TEXTILE_SIZES.reduce((s, size) => s + (qty[size] || 0), 0);
    rows.push({ color, qty, total });
    for (const size of TEXTILE_SIZES) sizeTotals[size] += qty[size] || 0;
  }
  const grandTotal = TEXTILE_SIZES.reduce((s, size) => s + sizeTotals[size], 0);

  return { rows, sizeTotals, grandTotal };
};
