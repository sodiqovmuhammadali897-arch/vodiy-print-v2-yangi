import type { CostTier, Expense, Order, OrderCost, OrderProduct } from "./types";
import { tierCostFor } from "./priceTiers";
import { VENDOR_EXPENSE_CATEGORY } from "./orderConstants";
import { discountShare } from "./orderCalculations";

// Margin = what an order line sold for minus what it cost us. The cost is
// typed by an admin on the Marja page (order_costs/{line id}, admin-only
// like product_costs) — per unit or as a total — optionally prefilled from
// the product's catalog cost tiers. Lines without a cost are counted
// separately, never guessed.

// Expenses that ARE the cost of goods: once costs are typed per line they
// must not be subtracted a second time from the profit.
export const COST_EXPENSE_CATEGORIES = [VENDOR_EXPENSE_CATEGORY, "Xomashyo"];

// An order with no product lines still gets one row (its own key).
export const orderOnlyKey = (orderId: string) => `order_${orderId}`;
// Editing an order rewrites its lines with new ids, so a cost is keyed by
// the order and the line's place in it, and remembers the product name: a
// different product in that place asks for the cost again.
export const lineCostKey = (orderId: string, index: number) => `${orderId}_L${index}`;
const sameProduct = (a: string | undefined, b: string | undefined) =>
  !a || String(a).trim().toLowerCase() === String(b || "").trim().toLowerCase();

export type MarginRow = {
  key: string; // order_costs doc id: lineCostKey(), or orderOnlyKey()
  legacyKey: string | null; // a cost saved under the line id (before lineCostKey)
  order: Order;
  line: OrderProduct | null;
  name: string;
  quantity: number;
  unitPrice: number;
  // The line's share of the order total, after the order-level discount
  // (lines are scaled so they add up to order.total_amount).
  revenue: number;
  cost: number | null;
  unitCost: number | null;
  suggestion: number | null; // catalog unit cost for this quantity
  profit: number | null;
  margin: number | null; // %
};

export const isSaleOrder = (o: Order) => o.status !== "cancelled" && !o.is_draft;

export function buildMarginRows(
  orders: Order[],
  lines: OrderProduct[],
  costs: Map<string, OrderCost>,
  catalogCost: (line: OrderProduct) => CostTier[] | null = () => null,
): MarginRow[] {
  const byOrder = new Map<string, OrderProduct[]>();
  for (const l of lines) {
    const arr = byOrder.get(l.order_id) || [];
    arr.push(l);
    byOrder.set(l.order_id, arr);
  }
  const rows: MarginRow[] = [];
  for (const order of orders) {
    const own = (byOrder.get(order.id) || []).sort((a, b) => (a.position || 0) - (b.position || 0));
    const total = Number(order.total_amount || 0);
    const linesSum = own.reduce((s, l) => s + Number(l.total || 0), 0);
    const scale = linesSum > 0 ? total / linesSum : 0;
    const items: { key: string; legacyKey: string | null; line: OrderProduct | null; name: string; quantity: number; unitPrice: number; revenue: number }[] = own.length
      ? own.map((l, i) => ({
          key: lineCostKey(order.id, i),
          legacyKey: l.id,
          line: l,
          name: [l.product_name, l.variant, l.size].filter(Boolean).join(", ") || l.category || "Mahsulot",
          quantity: Number(l.quantity || 0),
          unitPrice: Number(l.unit_price || 0),
          revenue: Number(l.total || 0) * scale,
        }))
      : [{ key: orderOnlyKey(order.id), legacyKey: null, line: null, name: order.title || "Buyurtma", quantity: 1, unitPrice: total, revenue: total }];
    for (const it of items) {
      const byPlace = costs.get(it.key);
      const saved =
        (byPlace && (!it.line || sameProduct(byPlace.product_name, it.line.product_name)) ? byPlace : undefined) ||
        (it.legacyKey ? costs.get(it.legacyKey) : undefined);
      const cost = saved ? Number(saved.total_cost || 0) : null;
      const tiers = it.line ? catalogCost(it.line) : null;
      rows.push({
        ...it,
        order,
        cost,
        unitCost: cost === null ? null : it.quantity > 0 ? cost / it.quantity : cost,
        suggestion: tiers && tiers.length ? tierCostFor(tiers, it.quantity) : null,
        profit: cost === null ? null : it.revenue - cost,
        margin: cost === null || it.revenue <= 0 ? null : ((it.revenue - cost) / it.revenue) * 100,
      });
    }
  }
  return rows;
}

export type MarginSummary = {
  revenue: number;
  lines: number;
  costedLines: number;
  costedRevenue: number;
  cost: number;
  profit: number; // on costed lines
  margin: number | null; // % on costed lines
  missingLines: number;
  missingRevenue: number;
  lowMargin: number; // costed lines under 15 %
  loss: number; // costed lines whose cost is above what they sold for
};

export function summarize(rows: MarginRow[]): MarginSummary {
  const costed = rows.filter((r) => r.cost !== null);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const costedRevenue = costed.reduce((s, r) => s + r.revenue, 0);
  const cost = costed.reduce((s, r) => s + (r.cost || 0), 0);
  return {
    revenue,
    lines: rows.length,
    costedLines: costed.length,
    costedRevenue,
    cost,
    profit: costedRevenue - cost,
    margin: costedRevenue > 0 ? ((costedRevenue - cost) / costedRevenue) * 100 : null,
    missingLines: rows.length - costed.length,
    missingRevenue: revenue - costedRevenue,
    lowMargin: costed.filter((r) => r.margin !== null && r.margin < 15).length,
    loss: costed.filter((r) => (r.profit ?? 0) < 0).length,
  };
}

// Aylanma − tannarx = yalpi foyda; − boshqa xarajatlar = sof foyda. While no
// cost has been typed for the period the old cash view (revenue − all
// expenses) is kept, so a month nobody filled in doesn't suddenly look
// richer by leaving out supplier payments.
export type ProfitBreakdown = {
  mode: "margin" | "cash";
  revenue: number;
  cost: number;
  gross: number;
  otherExpenses: number;
  costExpenses: number;
  net: number;
  missingLines: number;
  missingRevenue: number;
  costedLines: number;
  lines: number;
};

export function profitBreakdown(summary: MarginSummary, expenses: Pick<Expense, "amount" | "category">[]): ProfitBreakdown {
  const costExpenses = expenses.filter((e) => COST_EXPENSE_CATEGORIES.includes(e.category)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const all = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const base = {
    revenue: summary.revenue,
    cost: summary.cost,
    gross: summary.revenue - summary.cost,
    missingLines: summary.missingLines,
    missingRevenue: summary.missingRevenue,
    costedLines: summary.costedLines,
    lines: summary.lines,
    costExpenses,
  };
  if (summary.costedLines === 0) return { ...base, mode: "cash", otherExpenses: all, net: summary.revenue - all };
  const otherExpenses = all - costExpenses;
  return { ...base, mode: "margin", otherExpenses, net: summary.revenue - summary.cost - otherExpenses };
}

// Catalog cost tiers for a line: by the catalog product it was picked from,
// else by exact product name.
export function catalogCostLookup(
  products: { id: string; name: string }[],
  productCosts: { id: string; cost_tiers: CostTier[] }[],
): (line: OrderProduct) => CostTier[] | null {
  const byId = new Map(productCosts.filter((c) => (c.cost_tiers || []).length).map((c) => [c.id, c.cost_tiers]));
  const byName = new Map<string, CostTier[]>();
  for (const p of products) {
    const t = byId.get(p.id);
    if (t) byName.set(p.name.trim().toLowerCase(), t);
  }
  return (line) =>
    (line.catalog_product_id ? byId.get(line.catalog_product_id) : undefined) ||
    byName.get(String(line.product_name || "").trim().toLowerCase()) ||
    null;
}

// Lines written twice by an overlapping save (orderService now prevents
// it): the same order, place, product, quantity and price. Returns the ids
// of the extra copies, keeping the first of each.
export function findDuplicateLines(lines: OrderProduct[]): { ids: string[]; orders: Set<string> } {
  const seen = new Set<string>();
  const ids: string[] = [];
  const orders = new Set<string>();
  const sorted = [...lines].sort((a, b) => a.id.localeCompare(b.id));
  for (const l of sorted) {
    const k = [l.order_id, l.position ?? 0, String(l.product_name || "").trim().toLowerCase(), Number(l.quantity || 0), Number(l.unit_price || 0)].join("|");
    if (seen.has(k)) {
      ids.push(l.id);
      orders.add(l.order_id);
    } else seen.add(k);
  }
  return { ids, orders };
}

// The order total should be its lines minus the order discount; when it
// isn't, the order needs opening and saving again (or fixing).
export function totalMismatch(order: Order, lines: OrderProduct[]): number {
  const own = lines.filter((l) => l.order_id === order.id);
  if (!own.length) return 0;
  const expected = own.reduce((s, l) => s + Number(l.total || 0), 0) - Number(order.discount_amount || 0);
  const diff = Number(order.total_amount || 0) - expected;
  return Math.abs(diff) >= 1 ? diff : 0;
}

// Orders whose discounts (per line + on the order) are a large share of the
// list price — usually a paid amount typed into the discount box — and not
// yet confirmed as intended (order.discount_confirmed).
export function largeDiscountOrders(orders: Order[], lines: OrderProduct[]) {
  return orders
    .filter((o) => !o.discount_confirmed)
    .map((o) => {
      const own = lines.filter((l) => l.order_id === o.id);
      return { order: o, lines: own, ...discountShare(own, Number(o.discount_amount || 0)) };
    })
    .filter((x) => x.large);
}
