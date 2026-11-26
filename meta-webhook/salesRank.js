// «Jamoada o'rningiz — bu hafta» on the main Bosh sahifa (2026-11-26; the
// owner: «hammasi qo'shilsin»). Every 30 minutes, for the week from Monday
// 00:00 Tashkent: each seller's talk time (Mois Zvonki `calls`), ERP lead
// tasks done, and sales (orders by manager_name, like the KPI: not
// cancelled, not drafts, by order date) — and their place in the team on
// each. One doc per seller, sales_rank/{week}_{email}; the rules let a
// seller read only their own (their numbers and places, not the others'),
// the owner reads all.
const TZ = 5 * 3600e3;
const DAY = 864e5;
const key = (s) => String(s || "").trim().toLowerCase();
const dayOf = (v) => (!v ? "" : String(v).length === 10 ? String(v) : new Date(Date.parse(v) + TZ).toISOString().slice(0, 10));

// Monday of this week, as "YYYY-MM-DD" (Tashkent).
function weekStart(now = Date.now()) {
  const d = new Date(now + TZ);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
}

const talkOf = (c) => {
  if (!c.answered) return 0;
  const a = Date.parse(c.answer_time || "");
  const e = Date.parse(c.end_time || "");
  return e > a ? Math.round((e - a) / 1000) : Math.max(0, Number(c.duration_seconds) || 0);
};

// Places: 1 = most; equal values share a place.
function places(rows, field) {
  const vals = [...new Set(rows.map((r) => r[field]))].sort((a, b) => b - a);
  return new Map(rows.map((r) => [r.email, vals.indexOf(r[field]) + 1]));
}

// sellers: [{email, name, managerName}]. Pure.
function weekRank({ sellers, calls, tasks, orders, week }) {
  const rows = sellers.map((s) => ({ email: s.email, name: s.name, talk_sec: 0, done: 0, sales: 0, managerName: key(s.managerName) }));
  const byEmail = new Map(rows.map((r) => [r.email, r]));
  const byName = new Map(rows.filter((r) => r.managerName).map((r) => [r.managerName, r]));
  for (const c of calls) {
    const r = byEmail.get(key(c.staff_email));
    if (r && dayOf(c.start_time || c.created_at) >= week) r.talk_sec += talkOf(c);
  }
  for (const t of tasks) {
    const r = byEmail.get(key(t.assigned_to_email));
    if (r && t.status === "done" && !t.cancelled && t.completed_at && dayOf(t.completed_at) >= week) r.done++;
  }
  for (const o of orders) {
    if (o.status === "cancelled" || o.is_draft) continue;
    const r = byName.get(key(o.manager_name));
    const day = o.order_date ? String(o.order_date).slice(0, 10) : dayOf(o.created_at);
    if (r && day >= week) r.sales += Number(o.total_amount) || 0;
  }
  const p = { talk: places(rows, "talk_sec"), done: places(rows, "done"), sales: places(rows, "sales") };
  return rows.map(({ managerName, ...r }) => ({ ...r, rank: { talk: p.talk.get(r.email), done: p.done.get(r.email), sales: p.sales.get(r.email) }, of: rows.length }));
}

const create = (db, { contacts = null } = {}) => {
  const run = async (now = Date.now()) => {
    const index = contacts ? await contacts.load().catch(() => new Map()) : new Map();
    const notContact = (c) => !c.contact && !index.has(String(c.phone || "").replace(/\D/g, "").slice(-9));
    const week = weekStart(now);
    const from = new Date(Date.parse(`${week}T00:00:00+05:00`)).toISOString();
    const [staffSnap, managersSnap, callsSnap, tasksSnap, byDate, byCreated] = await Promise.all([
      db.collection("staff").get(),
      db.collection("managers").get(),
      db.collection("calls").where("created_at", ">=", from).get(),
      db.collection("lead_tasks").where("status", "==", "done").get(),
      db.collection("orders").where("order_date", ">=", week).get(),
      db.collection("orders").where("created_at", ">=", from).get(),
    ]);
    const managerName = new Map(managersSnap.docs.map((d) => [d.id, d.data().name || ""]));
    const sellers = staffSnap.docs
      .map((d) => ({ email: key(d.id), ...d.data() }))
      .filter((s) => s.report_manager_id && s.active !== false && s.is_active !== false)
      .map((s) => ({ email: s.email, name: s.full_name || s.email, managerName: managerName.get(s.report_manager_id) || s.full_name || "" }));
    if (!sellers.length) return 0;
    const orders = new Map();
    for (const d of [...byDate.docs, ...byCreated.docs]) orders.set(d.id, d.data());
    const rows = weekRank({ sellers, calls: callsSnap.docs.map((d) => d.data()).filter(notContact), tasks: tasksSnap.docs.map((d) => d.data()), orders: [...orders.values()], week });
    for (const r of rows) await db.collection("sales_rank").doc(`${week}_${r.email}`).set({ week, staff_email: r.email, ...r, updated_at: new Date(now).toISOString() });
    return rows.length;
  };
  let timer = null;
  const start = () => {
    if (timer) return;
    const tick = () => run().catch((e) => console.error("Sales rank failed:", e.message));
    setTimeout(tick, 45e3);
    timer = setInterval(tick, 30 * 60e3);
  };
  return { run, start };
};

module.exports = { create, weekRank, weekStart, places };
