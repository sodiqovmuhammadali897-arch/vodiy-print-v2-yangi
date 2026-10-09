// KPI (sotuv) — keeps kpi_sales/{YYYY-MM}_{managerId} current for this
// month and last: the manager's sales (orders entered that month), the
// money that came in that month on their orders, and what is still owed.
// The site's KPI pages read these documents live (a manager may read only
// its own — firestore.rules), so a new order or payment shows up at once.
// With the Telegram bot on, the manager also gets a short note for every
// new order (+sales %) and payment (+collect %). See src/lib/salesKpi.ts.
const { telegram } = require("./telegram");
const { orderDebt } = require("./shared");

const TZ_MS = 5 * 3600 * 1000;
const RECENT_MS = 24 * 3600 * 1000;
const DEFAULTS = { sales_rate: 7.5, collect_rate: 2, threshold: 80 };
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const LIST_MAX = 300;

const dayOf = (v) => (!v ? "" : String(v).length === 10 ? String(v) : new Date(Date.parse(v) + TZ_MS).toISOString().slice(0, 10));
const saleDay = (o) => (o.order_date ? String(o.order_date).slice(0, 10) : dayOf(o.created_at));
const payDay = (p) => (p.payment_date ? String(p.payment_date).slice(0, 10) : dayOf(p.created_at));
const isSale = (o) => o.status !== "cancelled" && !o.is_draft;
const key = (s) => String(s || "").trim().toLowerCase();
const monthNow = (now = Date.now()) => new Date(now + TZ_MS).toISOString().slice(0, 7);
const monthBefore = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
};
const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s\u00a0\u202f,]/g, " ")} so'm`;
const pct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace(".", ",")}%`;
const monthName = (m) => `${MONTHS[Number(String(m).slice(5, 7)) - 1] || m}`;
const first = (...v) => v.find((x) => x !== null && x !== undefined && Number.isFinite(Number(x)));

// One kpi_sales document per manager for `month`.
function summarize({ orders, payments, managers, month }) {
  const byName = new Map(managers.map((m) => [key(m.name), m]));
  const out = new Map(
    managers.map((m) => [
      m.id,
      { id: `${month}_${m.id}`, month, manager_id: m.id, manager_name: m.name || "", sales: 0, collected: 0, debt: 0, order_count: 0, orders: [], payments: [] },
    ]),
  );
  const orderById = new Map(orders.map((o) => [o.id, o]));
  for (const o of orders) {
    if (!isSale(o)) continue;
    const m = byName.get(key(o.manager_name));
    if (!m) continue;
    const r = out.get(m.id);
    r.debt += orderDebt(o);
    if (!saleDay(o).startsWith(month)) continue;
    const total = Number(o.total_amount || 0);
    r.sales += total;
    r.order_count += 1;
    r.orders.push({ id: o.id, n: o.order_number || "", title: o.title || "", customer: o.customer_name || "", total, date: saleDay(o) });
  }
  for (const p of payments) {
    const day = payDay(p);
    if (!day.startsWith(month)) continue;
    const o = orderById.get(p.order_id);
    if (!o || o.status === "cancelled") continue;
    const m = byName.get(key(o.manager_name));
    if (!m) continue;
    const r = out.get(m.id);
    const amount = Number(p.amount || 0);
    r.collected += amount;
    r.payments.push({ id: p.id, order_id: o.id, n: o.order_number || "", amount, date: day });
  }
  for (const r of out.values()) {
    r.orders.sort((a, b) => b.date.localeCompare(a.date) || b.n.localeCompare(a.n));
    r.payments.sort((a, b) => b.date.localeCompare(a.date));
    r.orders = r.orders.slice(0, LIST_MAX);
    r.payments = r.payments.slice(0, LIST_MAX);
    r.sales = Math.round(r.sales);
    r.collected = Math.round(r.collected);
    r.debt = Math.round(r.debt);
  }
  return [...out.values()];
}

const orderText = (o, rate, doc) =>
  [
    `🧾 Yangi buyurtma ${o.order_number || ""}`.trim(),
    o.customer_name || o.title ? `${o.customer_name || o.title}` : null,
    `Summa: ${money(o.total_amount)}`,
    `➕ Bonus: ${money((Number(o.total_amount || 0) * rate) / 100)} (${pct(rate)})`,
    "",
    `${monthName(doc.month)}: sotuv ${money(doc.sales)} → ${money((doc.sales * rate) / 100)}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

const paymentText = (p, o, rate, doc) =>
  [
    `💰 Kirim: ${money(p.amount)}${o.order_number ? ` (${o.order_number})` : ""}`,
    `➕ ${money((Number(p.amount || 0) * rate) / 100)} (${pct(rate)} — davomat va amoCRM sharti bilan)`,
    "",
    `${monthName(doc.month)}: kirim ${money(doc.collected)} → ${money((doc.collected * rate) / 100)}`,
  ].join("\n");

const create = (db, { notify = false } = {}) => {
  const data = { orders: null, payments: null, managers: null };
  const unsubs = [];
  const written = new Map(); // doc id → last JSON written
  let seenOrders = null; // sale order ids at the last run
  let seenPayments = null;
  let timer = null;
  let running = false;
  let again = false;

  const chatsOf = async (managerId) =>
    (await db.collection("staff").where("report_manager_id", "==", managerId).get()).docs
      .map((d) => d.data())
      .filter((s) => s.telegram_chat_id && s.permissions && s.permissions.kpi && s.permissions.kpi.view)
      .map((s) => s.telegram_chat_id);

  const ratesOf = async (manager, month) => {
    const [settings, km] = await Promise.all([
      db.collection("kpi_settings").doc("sales").get(),
      db.collection("kpi_months").doc(`${month}_${manager.id}`).get(),
    ]);
    const s = { ...DEFAULTS, ...(settings.exists ? settings.data() : {}) };
    const k = km.exists ? km.data() : {};
    return {
      sales: Number(first(k.sales_rate, manager.sales_rate, s.sales_rate)),
      collect: Number(first(k.collect_rate, manager.collect_rate, s.collect_rate)),
    };
  };

  const send = async (managerId, text) => {
    for (const chat_id of await chatsOf(managerId)) await telegram("sendMessage", { chat_id, text });
  };

  const announce = async (docs, month) => {
    const { orders, payments, managers } = data;
    const byName = new Map(managers.map((m) => [key(m.name), m]));
    const docOf = new Map(docs.map((d) => [d.manager_id, d]));
    const recent = (iso) => !iso || Date.now() - Date.parse(iso) < RECENT_MS;
    for (const o of orders) {
      if (!isSale(o) || seenOrders.has(o.id) || !saleDay(o).startsWith(month) || !recent(o.created_at)) continue;
      const m = byName.get(key(o.manager_name));
      if (!m) continue;
      const r = await ratesOf(m, month);
      await send(m.id, orderText(o, r.sales, docOf.get(m.id)));
    }
    const orderById = new Map(orders.map((o) => [o.id, o]));
    for (const p of payments) {
      if (seenPayments.has(p.id) || !payDay(p).startsWith(month) || !recent(p.created_at)) continue;
      const o = orderById.get(p.order_id);
      const m = o && o.status !== "cancelled" ? byName.get(key(o.manager_name)) : null;
      if (!m) continue;
      const r = await ratesOf(m, month);
      await send(m.id, paymentText(p, o, r.collect, docOf.get(m.id)));
    }
  };

  const run = async () => {
    if (!data.orders || !data.payments || !data.managers) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const month = monthNow();
      let current = [];
      for (const m of [monthBefore(month), month]) {
        const docs = summarize({ ...data, month: m });
        if (m === month) current = docs;
        for (const doc of docs) {
          const json = JSON.stringify(doc);
          if (written.get(doc.id) === json) continue;
          await db.collection("kpi_sales").doc(doc.id).set({ ...doc, updated_at: new Date().toISOString() });
          written.set(doc.id, json);
        }
      }
      if (notify && seenOrders) await announce(current, month).catch((err) => console.error("KPI notice failed", err.message));
      seenOrders = new Set(data.orders.filter(isSale).map((o) => o.id));
      seenPayments = new Set(data.payments.map((p) => p.id));
    } catch (err) {
      console.error("KPI sales update failed", err.message);
    } finally {
      running = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 2000);
  };

  const watch = (name) =>
    db.collection(name).onSnapshot(
      (snap) => {
        data[name === "order_payments" ? "payments" : name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        schedule();
      },
      (err) => console.error(`KPI ${name} listener error`, err.message),
    );

  const start = () => {
    unsubs.push(watch("orders"), watch("order_payments"), watch("managers"));
    // The month rolls over at midnight with no write to wake us.
    unsubs.push(((t) => () => clearInterval(t))(setInterval(schedule, 30 * 60 * 1000)));
    console.log("KPI sales started");
  };
  const stop = () => unsubs.forEach((u) => u());

  return { start, stop };
};

module.exports = { create, summarize, orderText, paymentText, monthBefore };
