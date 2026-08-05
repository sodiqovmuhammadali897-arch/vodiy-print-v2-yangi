import type { OrderProduct, SizeBreakdownEntry } from "./types";
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

const emptySizeTotals = (): Record<string, number> =>
  Object.fromEntries(TEXTILE_SIZES.map((s) => [s, 0]));

// Turns a flat list of {color, size, qty} entries (as stored on an order
// line item or a saved template) into a read-only pivot table.
export const pivotBreakdownEntries = (entries: SizeBreakdownEntry[]): TextileMatrix => {
  const byColor = new Map<string, Record<string, number>>();
  for (const entry of entries) {
    if (!byColor.has(entry.color)) byColor.set(entry.color, emptySizeTotals());
    const row = byColor.get(entry.color)!;
    if (TEXTILE_SIZES.includes(entry.size as (typeof TEXTILE_SIZES)[number])) {
      row[entry.size] = (row[entry.size] || 0) + Number(entry.qty || 0);
    }
  }

  const sizeTotals = emptySizeTotals();
  const rows: TextileMatrixRow[] = [];
  for (const [color, qty] of byColor) {
    const total = TEXTILE_SIZES.reduce((s, size) => s + (qty[size] || 0), 0);
    rows.push({ color, qty, total });
    for (const size of TEXTILE_SIZES) sizeTotals[size] += qty[size] || 0;
  }
  const grandTotal = TEXTILE_SIZES.reduce((s, size) => s + sizeTotals[size], 0);

  return { rows, sizeTotals, grandTotal };
};

// Merges every Textil-category line item's size_breakdown for an order into
// one color x size table — most orders have a single Textil line, but this
// stays correct if someone ever splits one order across several.
export const pivotTextileBreakdown = (products: OrderProduct[]): TextileMatrix => {
  const entries = products
    .filter((p) => p.category === "Textil" && Array.isArray(p.size_breakdown))
    .flatMap((p) => p.size_breakdown);
  return pivotBreakdownEntries(entries);
};

// --- Editable matrix (used by the order-line matrix modal and the
// standalone template builder) ---

export type SizeMatrixRow = { color: string; qty: Record<string, number> };

export const emptySizeMatrixQty = emptySizeTotals;

export const breakdownToMatrixRows = (breakdown: SizeBreakdownEntry[]): SizeMatrixRow[] => {
  const byColor = new Map<string, SizeMatrixRow>();
  for (const entry of breakdown) {
    if (!byColor.has(entry.color)) {
      byColor.set(entry.color, { color: entry.color, qty: emptySizeTotals() });
    }
    const row = byColor.get(entry.color)!;
    if (TEXTILE_SIZES.includes(entry.size as (typeof TEXTILE_SIZES)[number])) {
      row.qty[entry.size] = Number(entry.qty) || 0;
    }
  }
  return Array.from(byColor.values());
};

export const matrixRowsToBreakdown = (rows: SizeMatrixRow[]): SizeBreakdownEntry[] => {
  const out: SizeBreakdownEntry[] = [];
  for (const row of rows) {
    for (const size of TEXTILE_SIZES) {
      const qty = Number(row.qty[size]) || 0;
      if (qty > 0) out.push({ color: row.color, size, qty });
    }
  }
  return out;
};
