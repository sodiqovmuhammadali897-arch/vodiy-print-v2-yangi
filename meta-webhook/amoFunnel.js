// Sotuv voronkasi — the leads of a month (by the day they came in) and how
// far each got: talked (a call of 30+ s with the lead or its contact),
// each amoCRM stage it ever reached (from the stage-change history, so a
// lost lead still counts for the stages it passed), won or lost, then the
// ERP: an order from the same customer (phone match) within 60 days of
// the lead, and money in on it. Per manager, per source, how fast, and
// what is out of order in amoCRM. Pure; amocrm.js loads the data and
// writes amo_funnel/{YYYY-MM} (counts only — no names or phones).

const WON = 142;
const LOST = 143;
const DAY = 86400000;
const TZ_MS = 5 * 3600 * 1000;
const dayOf = (ms) => new Date(ms + TZ_MS).toISOString().slice(0, 10);
const monthOf = (ms) => dayOf(ms).slice(0, 7);
const phoneKey = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};
const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  return a.length ? a[Math.floor((a.length - 1) / 2)] : null;
};
const saleDay = (o) => (o.order_date ? String(o.order_date).slice(0, 10) : o.created_at ? dayOf(Date.parse(o.created_at)) : "");
const payDay = (p) => (p.payment_date ? String(p.payment_date).slice(0, 10) : p.created_at ? dayOf(Date.parse(p.created_at)) : "");
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

// The stages of the pipeline most of the month's leads are in, in order,
// without won/lost. `info` and `offer` — the stages the report names
// «Ma'lumot berildi» and «Taklif yuborildi».
function stagesOf(statuses, leads) {
  const count = {};
  for (const l of leads) if (l.pipeline) count[l.pipeline] = (count[l.pipeline] || 0) + 1;
  const main = Number(Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
  const stages = Object.entries(statuses)
    .map(([key, s]) => ({ key, id: Number(key.split(":")[1]), pipeline: Number(key.split(":")[0]), name: s.name, sort: Number(s.sort || 0) }))
    .filter((s) => (!main || s.pipeline === main) && s.id !== WON && s.id !== LOST)
    .sort((a, b) => a.sort - b.sort);
  const find = (re, i) => (stages.find((s) => re.test(s.name.toLowerCase())) || stages[i] || null)?.key || null;
  return { stages, info: find(/маълумот|малумот|ma.?lumot|информ/, 2), offer: find(/таклиф|taklif|кп|предлож/, 3) };
}

function newRow() {
  return { leads: 0, talked: 0, reached: {}, won: 0, lost: 0, lost_no_reason: 0, loss: {}, lost_after: {}, ordered: 0, paid: 0, order_sum: 0, first_call: [], to_order: [] };
}
const finish = (r, callsKnown) => {
  const { first_call, to_order, ...rest } = r;
  return { ...rest, talked: callsKnown ? r.talked : null, first_call_min: callsKnown ? median(first_call) : null, lead_to_order_days: median(to_order) };
};

function computeFunnel({ month, leads, calls, history, statuses, contactPhones, users, orders, customers, payments, callsFrom, now, windowDays = 60, talkSec = 30 }) {
  const cohort = leads.filter((l) => l.created && monthOf(l.created) === month);
  const { stages, info, offer } = stagesOf(statuses, cohort);
  const sortOf = new Map(stages.map((s) => [s.key, s.sort]));
  const firstStage = stages.find((s) => s.sort > (stages[0]?.sort ?? 0) || stages.length === 1) || stages[0];
  const monthStart = Date.parse(`${month}-01T00:00:00Z`) - TZ_MS;
  const callsKnown = callsFrom <= monthStart;

  // Calls by lead and by contact.
  const callsBy = new Map();
  for (const c of calls) {
    if (!c.entityId) continue;
    const k = `${c.entity}:${c.entityId}`;
    if (!callsBy.has(k)) callsBy.set(k, []);
    callsBy.get(k).push(c);
  }
  // ERP: customers by phone, their sale orders by day, first payment day.
  const custByPhone = new Map();
  for (const c of customers) {
    const keys = new Set(Object.entries(c).filter(([k, v]) => /phone/i.test(k) && typeof v === "string").map(([, v]) => phoneKey(v)).filter(Boolean));
    for (const k of keys) {
      if (!custByPhone.has(k)) custByPhone.set(k, new Set());
      custByPhone.get(k).add(c.id);
    }
  }
  const ordersByCust = new Map();
  for (const o of orders) {
    if (o.status === "cancelled" || o.is_draft || !o.customer_id) continue;
    if (!ordersByCust.has(o.customer_id)) ordersByCust.set(o.customer_id, []);
    ordersByCust.get(o.customer_id).push(o);
  }
  for (const list of ordersByCust.values()) list.sort((a, b) => saleDay(a).localeCompare(saleDay(b)));
  const firstPay = new Map();
  for (const p of payments) {
    const d = payDay(p);
    if (d && (!firstPay.has(p.order_id) || d < firstPay.get(p.order_id))) firstPay.set(p.order_id, d);
  }
  const used = new Set(); // an order counts for one lead only
  const visited = {}; // stage key → leads actually put in it (history or now)

  const all = newRow();
  const byUser = new Map();
  const bySource = new Map();
  const toPaid = [];
  for (const l of cohort.sort((a, b) => a.created - b.created)) {
    const rows = [all, byUser.get(l.user) || (byUser.set(l.user, newRow()), byUser.get(l.user))];
    const src = String(l.source || "Noma'lum").slice(0, 40);
    if (!bySource.has(src)) bySource.set(src, { name: src, leads: 0, ordered: 0 });
    const s = bySource.get(src);
    s.leads++;
    for (const r of rows) r.leads++;

    // Talked, and how soon the first call came.
    const lc = [...(callsBy.get(`l:${l.id}`) || []), ...(l.contact ? callsBy.get(`c:${l.contact}`) || [] : [])].filter((c) => c.at >= l.created - 3600000 && c.at <= l.created + windowDays * DAY);
    if (lc.some((c) => c.duration >= talkSec)) for (const r of rows) r.talked++;
    const firstCall = lc.reduce((m, c) => (c.at >= l.created && (!m || c.at < m) ? c.at : m), 0);
    if (firstCall) for (const r of rows) r.first_call.push(Math.round((firstCall - l.created) / 60000));

    // The furthest stage reached.
    const seen = new Set(history.get(l.id) || []);
    const cur = `${l.pipeline}:${l.status}`;
    if (l.status !== WON && l.status !== LOST && sortOf.has(cur)) seen.add(cur);
    let max = -Infinity;
    for (const k of seen) {
      if (!sortOf.has(k)) continue;
      max = Math.max(max, sortOf.get(k));
      visited[k] = (visited[k] || 0) + 1;
    }
    if (l.status === WON) max = Infinity;
    for (const st of stages) if (st.sort <= max) for (const r of rows) r.reached[st.key] = (r.reached[st.key] || 0) + 1;
    if (l.status === WON) for (const r of rows) r.won++;
    if (l.status === LOST) {
      const at = stages.filter((st) => st.sort <= max).pop();
      for (const r of rows) {
        r.lost++;
        if (!l.loss) r.lost_no_reason++;
        else r.loss[l.loss] = (r.loss[l.loss] || 0) + 1;
        const k = at ? at.key : "none";
        r.lost_after[k] = (r.lost_after[k] || 0) + 1;
      }
    }

    // The ERP order: same phone, from the day before the lead to 60 days on.
    const keys = contactPhones.get(l.contact) || [];
    const from = dayOf(l.created - DAY);
    const to = dayOf(l.created + windowDays * DAY);
    let order = null;
    for (const k of keys) {
      for (const cid of custByPhone.get(k) || []) {
        for (const o of ordersByCust.get(cid) || []) {
          const d = saleDay(o);
          if (d >= from && d <= to && !used.has(o.id) && (!order || d < saleDay(order))) order = o;
        }
      }
    }
    if (order) {
      used.add(order.id);
      s.ordered++;
      const paid = Number(order.paid_amount || 0) > 0 || firstPay.has(order.id);
      for (const r of rows) {
        r.ordered++;
        r.order_sum += Number(order.total_amount || 0);
        r.to_order.push(Math.max(0, daysBetween(dayOf(l.created), saleDay(order))));
        if (paid) r.paid++;
      }
      if (firstPay.has(order.id)) toPaid.push(Math.max(0, daysBetween(saleDay(order), firstPay.get(order.id))));
    }
  }

  // amoCRM order: open leads still in the first stage after 2+ days, stages
  // nobody used this month, and the ERP orders of the month against won.
  const open = leads.filter((l) => l.status !== WON && l.status !== LOST && l.status !== -1);
  const stuck = firstStage ? open.filter((l) => `${l.pipeline}:${l.status}` === firstStage.key && now - l.created > 2 * DAY).length : 0;
  const erpOrders = orders.filter((o) => o.status !== "cancelled" && !o.is_draft && saleDay(o).startsWith(month)).length;
  const wonInMonth = leads.filter((l) => l.status === WON && l.closed && monthOf(l.closed) === month).length;

  return {
    month,
    stages: stages.map(({ key, name, sort }) => ({ key, name, sort })),
    info_key: info,
    offer_key: offer,
    first_stage_key: firstStage ? firstStage.key : null,
    calls_known: callsKnown,
    window_days: windowDays,
    talk_sec: talkSec,
    all: finish(all, callsKnown),
    users: [...byUser.entries()]
      .map(([id, r]) => ({ id: Number(id) || 0, name: (users.get(Number(id)) || {}).name || (id ? `#${id}` : "Mas'ul yo'q"), ...finish(r, callsKnown) }))
      .sort((a, b) => b.leads - a.leads),
    sources: [...bySource.values()].sort((a, b) => b.leads - a.leads).slice(0, 12),
    speed: { first_call_min: callsKnown ? median(all.first_call) : null, lead_to_order_days: median(all.to_order), order_to_paid_days: median(toPaid) },
    hygiene: {
      stuck_first_stage: stuck,
      // Stages no lead of the month was actually put in (a won lead is
      // counted as past them, but nobody moved it there).
      unused_stages: stages.filter((st, i) => i > 0 && st.key !== firstStage?.key && !visited[st.key]).map((st) => st.name),
      erp_orders: erpOrders,
      amo_won: wonInMonth,
      lost_no_reason: all.lost_no_reason,
      lost: all.lost,
    },
  };
}

// The status keys a lead was ever in, from amoCRM events (lead_status_changed).
function historyFromEvents(events, into = new Map()) {
  for (const e of events) {
    const id = Number(e.entity_id || 0);
    if (!id) continue;
    if (!into.has(id)) into.set(id, new Set());
    for (const v of [...(e.value_before || []), ...(e.value_after || [])]) {
      const s = v && v.lead_status;
      if (s && s.id) into.get(id).add(`${s.pipeline_id}:${s.id}`);
    }
  }
  return into;
}

// Every phone of an amoCRM contact, as last-9-digit keys (memory only).
const contactPhoneKeys = (c) =>
  [
    ...new Set(
      (c.custom_fields_values || [])
        .filter((f) => f.field_code === "PHONE")
        .flatMap((f) => f.values || [])
        .map((v) => phoneKey(v.value))
        .filter(Boolean),
    ),
  ];

module.exports = { computeFunnel, historyFromEvents, contactPhoneKeys, stagesOf, phoneKey };
