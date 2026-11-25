// Reklama 2.0, phase 3 — which ad brought which money (the owner's TZ:
// «Reklama → lid → buyurtma → tushum → foyda»).
//
// An ERP lead from a Facebook/Instagram form keeps its ad ids (campaign,
// ad set, ad). Its phone is matched to ERP customers (last 9 digits); that
// customer's sale orders from the day before the lead to 60 days after
// belong to the lead — each order to one lead only (the earliest). A lead
// the CRM turned into an order (`converted_order_id`) counts that order
// even without a phone match. For each lead: orders, sales, money paid,
// typed cost (order_costs) and whether the customer is new (no sale order
// before). Written as ads_attr/{lead month}: ids and numbers only — no
// names or phones.

const DAY = 86400000;
const TZ_MS = 5 * 3600 * 1000;
const dayOf = (ms) => new Date(ms + TZ_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const phoneKey = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};
const saleDay = (o) => (o.order_date ? String(o.order_date).slice(0, 10) : o.created_at ? dayOf(Date.parse(o.created_at)) : "");
const isSale = (o) => o.status !== "cancelled" && !o.is_draft;
const AD_SOURCES = new Set(["Facebook Lead Ads", "Instagram Target"]);
const num = (v) => Number(v || 0) || 0;

function attribute({ leads, customers, orders, payments = [], costs = [], windowDays = 60, today = dayOf(Date.now()) }) {
  // Customers by every phone they have.
  const custByPhone = new Map();
  for (const c of customers) {
    const keys = new Set(Object.entries(c).filter(([k, v]) => /phone/i.test(k) && typeof v === "string").map(([, v]) => phoneKey(v)).filter(Boolean));
    for (const k of keys) {
      if (!custByPhone.has(k)) custByPhone.set(k, new Set());
      custByPhone.get(k).add(c.id);
    }
  }
  const sales = orders.filter(isSale);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const byCust = new Map();
  for (const o of sales) {
    if (!o.customer_id) continue;
    if (!byCust.has(o.customer_id)) byCust.set(o.customer_id, []);
    byCust.get(o.customer_id).push(o);
  }
  for (const l of byCust.values()) l.sort((a, b) => saleDay(a).localeCompare(saleDay(b)));
  const paid = new Map();
  for (const p of payments) paid.set(p.order_id, (paid.get(p.order_id) || 0) + num(p.amount));
  const cost = new Map();
  for (const c of costs) if (c.order_id) cost.set(c.order_id, (cost.get(c.order_id) || 0) + num(c.total_cost));

  const used = new Set();
  const rows = [];
  const adLeads = leads.filter((l) => AD_SOURCES.has(l.source) && l.created_at).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const l of adLeads) {
    const day = dayOf(Date.parse(l.created_at));
    const from = addDays(day, -1);
    const to = addDays(day, windowDays);
    const custIds = new Set(custByPhone.get(phoneKey(l.phone)) || []);
    const mine = [];
    const conv = l.converted_order_id && byId.get(l.converted_order_id);
    if (conv && isSale(conv) && !used.has(conv.id)) {
      mine.push(conv);
      if (conv.customer_id) custIds.add(conv.customer_id);
    }
    for (const cid of custIds)
      for (const o of byCust.get(cid) || []) {
        const d = saleDay(o);
        if (d >= from && d <= to && !used.has(o.id) && !mine.includes(o)) mine.push(o);
      }
    for (const o of mine) used.add(o.id);
    // New customer: no sale order of theirs before the lead's window.
    const before = [...custIds].some((cid) => (byCust.get(cid) || []).some((o) => saleDay(o) < from));
    const revenue = mine.reduce((s, o) => s + num(o.total_amount), 0);
    const costed = mine.filter((o) => cost.has(o.id));
    rows.push({
      id: String(l.id),
      day,
      c: String(l.campaign_id || ""),
      s: String(l.adset_id || ""),
      a: String(l.ad_id || ""),
      found: custIds.size > 0,
      orders: mine.length,
      revenue: Math.round(revenue),
      paid: Math.round(mine.reduce((s, o) => s + Math.min(num(o.total_amount), Math.max(num(o.paid_amount), paid.get(o.id) || 0)), 0)),
      cost: Math.round(costed.reduce((s, o) => s + cost.get(o.id), 0)),
      cost_rev: Math.round(costed.reduce((s, o) => s + num(o.total_amount), 0)),
      new: mine.length > 0 && !before,
      first: mine.length ? mine.map(saleDay).sort()[0] : null,
      open: to >= today, // still inside the 60 days — more orders may come
    });
  }
  return rows;
}

// ads_attr/{YYYY-MM}: the month's leads, by lead day.
function byMonth(rows) {
  const out = new Map();
  for (const r of rows) {
    const m = r.day.slice(0, 7);
    if (!out.has(m)) out.set(m, []);
    out.get(m).push(r);
  }
  return out;
}

module.exports = { attribute, byMonth, phoneKey, AD_SOURCES };
