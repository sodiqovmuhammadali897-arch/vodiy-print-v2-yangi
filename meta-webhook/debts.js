// Qarz undirish.
//
// A debt is the unpaid rest of an order handed to the customer (delivered
// or closed); its days count from the day it was handed over (the order's
// status history, else its delivery date, else its date). An order that is
// ready but not handed over yet with money still owed is «collect on
// delivery» — listed apart, without buttons. The order's manager (by
// name, as in the ERP) is the owner of the debt.
//
// Every working day at 10:00 (Tashkent) each sales manager gets their
// debts, oldest first: customer, phone, order, sum, days — with
// 🤝 Va'da berdi (pick the day) · 📵 Javob bermadi · ✅ To'ladi (a link to
// enter the payment in the ERP; the debt leaves the list only when the
// payment is in). A debt with a promise for a later day waits for it.
// At 19:00 the admins get: collected today per manager, debts left, old
// ones (over OLD_DAYS) and promises not kept. State per order in
// debt_calls/{orderId}; recall.js picks the managers and the admins.
const { telegram } = require("./telegram");
const { todayCode, customerName } = require("./shared");

const START = process.env.DEBTS_START || process.env.RECALL_START || "2026-11-02";
const SEND_AT = 10 * 60;
const SUMMARY_AT = 19 * 60 + 5;
const OLD_DAYS = 14;
const MAX_MSGS = 8;
const TICK_MS = 60 * 1000;
const SITE = process.env.PUBLIC_SITE_URL || "https://printvodiy.uz";
const HANDED = new Set(["delivered", "closed"]);
const READY = new Set(["ready", "ready_to_deliver"]);
// Orders belong to their manager by name, as everywhere in the ERP.
const nameKey = (s) => String(s || "").trim().toLowerCase();
const PROMISE = { 1: "Ertaga", 3: "3 kundan keyin", 7: "1 haftadan keyin" };

const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day, n) => new Date(dayMs(day) + n * 86400e3).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400e3);
const tkDay = (iso) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(0, 10) : "");
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const mln = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(Math.round(v / 1e5) / 10).toString().replace(".", ",")} mln`;
  return `${Math.round(v / 1000)} ming`;
};

// The day an order was handed over: the first move to delivered/closed in
// its history, else its delivery date, else its date.
const handedDay = (o, history) => {
  const moves = history.filter((h) => HANDED.has(h.status) && h.changed_at).map((h) => tkDay(h.changed_at)).sort();
  return moves[0] || String(o.delivery_date || "").slice(0, 10) || String(o.order_date || "").slice(0, 10) || tkDay(o.created_at);
};

// { debts: [...], onDelivery: [...] } per manager name (lower case). Each debt:
// { order_id, number, title, customer_id, rest, day, days }.
const debtsByManager = (orders, historyOf, today) => {
  const out = new Map();
  const of = (m) => {
    if (!out.has(m)) out.set(m, { debts: [], onDelivery: [] });
    return out.get(m);
  };
  for (const o of orders) {
    const rest = Number(o.remaining_amount || 0);
    const owner = nameKey(o.manager_name);
    if (rest <= 0 || o.status === "cancelled" || o.is_draft || !owner) continue;
    const base = { order_id: o.id, number: o.order_number || "", title: o.title || "", customer_id: o.customer_id || null, rest };
    if (HANDED.has(o.status)) {
      const day = handedDay(o, historyOf.get(o.id) || []);
      of(owner).debts.push({ ...base, day, days: Math.max(0, daysBetween(day, today)) });
    } else if (READY.has(o.status)) of(owner).onDelivery.push(base);
  }
  for (const v of out.values()) v.debts.sort((a, b) => b.days - a.days || b.rest - a.rest);
  return out;
};

// Which debts the manager is asked about today: no promise, or a promise
// that is due or passed.
const dueToday = (debts, state, today) => debts.filter((d) => !(state.get(d.order_id) || {}).promise_day || state.get(d.order_id).promise_day <= today);

const debtText = (d, c, i, n, st) => {
  const who = c ? (c.company ? `${c.company}${customerName(c) !== c.company ? ` — ${customerName(c)}` : ""}` : customerName(c)) : "mijoz yozilmagan";
  const phones = c ? [c.phone, c.extra_phone].filter(Boolean).join(", ") : "";
  const lines = [`${i}/${n} · ${who}`];
  if (phones) lines.push(`📞 ${phones}`);
  lines.push("", `${d.number ? `${d.number} · ` : ""}${d.title}`, `Qarz: ${mln(d.rest)} · topshirilganiga ${d.days} kun${d.days > OLD_DAYS ? " ⚠️" : ""}`);
  if (st && st.promise_day) lines.push(`🤝 ${dayLabel(st.promise_day)}ga va'da bergan edi — to'lov tushmagan`);
  return lines.join("\n");
};
const buttons = (id) => ({
  inline_keyboard: [
    [{ text: "🤝 Va'da berdi", callback_data: `db:p:${id}` }, { text: "📵 Javob bermadi", callback_data: `db:a:${id}` }],
    [{ text: "✅ To'ladi", callback_data: `db:o:${id}` }],
  ],
});
const promiseButtons = (id) => ({
  inline_keyboard: [
    [{ text: PROMISE[1], callback_data: `db:P:${id}:1` }, { text: PROMISE[3], callback_data: `db:P:${id}:3` }, { text: PROMISE[7], callback_data: `db:P:${id}:7` }],
    [{ text: "↩️ Orqaga", callback_data: `db:b:${id}` }],
  ],
});

const summaryText = (today, rows, broken) => {
  const lines = [`💰 Qarz undirish — ${dayLabel(today)}`, ""];
  for (const r of rows) lines.push(`${r.name} — bugun undirdi ${mln(r.collected)} · qarz ${mln(r.debt)} (${r.count} ta)${r.old ? ` · ${OLD_DAYS}+ kun: ${r.old} ⚠️` : ""}`);
  const total = rows.reduce((t, r) => t + r.debt, 0);
  const got = rows.reduce((t, r) => t + r.collected, 0);
  lines.push("", `Jami: bugun ${mln(got)} undirildi · qarz ${mln(total)}`);
  if (broken.length) lines.push("", "❗ Va'da bajarilmadi:", ...broken.map((b) => `• ${b.who} — ${mln(b.rest)} · ${dayLabel(b.promise_day)}ga va'da · ${b.manager}`));
  return lines.join("\n");
};

const create = (db, { team, admins }) => {
  const state = db.collection("debt_calls");
  const days = db.collection("debt_days");
  const all = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  const load = async (today) => {
    const [orders, history, customers, payments, st] = await Promise.all([all("orders"), all("order_status_history"), all("customers"), all("order_payments"), all("debt_calls")]);
    const historyOf = new Map();
    for (const h of history) {
      if (!historyOf.has(h.order_id)) historyOf.set(h.order_id, []);
      historyOf.get(h.order_id).push(h);
    }
    return {
      orders,
      byManager: debtsByManager(orders, historyOf, today),
      customer: new Map(customers.map((c) => [c.id, c])),
      payments,
      state: new Map(st.map((s) => [s.id, s])),
    };
  };

  // `preview`: send to these chats instead, marked SINOV, without buttons.
  const sendDay = async (today, preview = null) => {
    const people = await team();
    const data = await load(today);
    const counts = {};
    for (const m of people) {
      const mine = data.byManager.get(nameKey(m.name)) || { debts: [], onDelivery: [] };
      const due = dueToday(mine.debts, data.state, today);
      const waiting = mine.debts.length - due.length;
      const shown = due.slice(0, MAX_MSGS);
      counts[m.name] = shown.length;
      const chats = preview || [m.chat];
      if (!mine.debts.length && !mine.onDelivery.length) continue;
      const head = [
        `💰 ${m.name}, qarzlaringiz: ${mln(mine.debts.reduce((t, d) => t + d.rest, 0))} · ${mine.debts.length} ta buyurtma`,
        shown.length ? `Bugun shularga qo'ng'iroq qiling (${shown.length} ta${due.length > shown.length ? `, qolgan ${due.length - shown.length} tasi ertaga` : ""}).` : "Bugun qo'ng'iroq qilinadigan qarz yo'q.",
        waiting ? `🤝 Va'da kuni kelmaganlar: ${waiting} ta.` : "",
        mine.onDelivery.length ? `\n📦 Topshirishda qoldiqni oling:\n${mine.onDelivery.map((d) => `• ${d.number ? `${d.number} · ` : ""}${d.title} — ${mln(d.rest)}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");
      for (const chat of chats) await telegram("sendMessage", { chat_id: chat, text: preview ? `🧪 SINOV · ${m.name}\n\n${head}` : head }).catch(() => undefined);
      for (const [i, d] of shown.entries()) {
        const text = debtText(d, data.customer.get(d.customer_id), i + 1, shown.length, data.state.get(d.order_id));
        if (preview) {
          for (const chat of chats) await telegram("sendMessage", { chat_id: chat, text }).catch(() => undefined);
          continue;
        }
        await state.doc(d.order_id).set({ manager_id: m.manager_id, manager_name: m.name, chat_id: m.chat, staff_email: m.email, rest: d.rest, text, asked_day: today }, { merge: true });
        await telegram("sendMessage", { chat_id: m.chat, text, reply_markup: buttons(d.order_id) }).catch(() => undefined);
      }
    }
    return { counts };
  };

  const sendSummary = async (today) => {
    const people = await team();
    const data = await load(today);
    const ordersById = new Map(data.orders.map((o) => [o.id, o]));
    const paidToday = data.payments.filter((p) => (String(p.payment_date || "").slice(0, 10) || tkDay(p.created_at)) === today);
    const rows = people.map((m) => {
      const mine = (data.byManager.get(nameKey(m.name)) || { debts: [] }).debts;
      const collected = paidToday.filter((p) => nameKey((ordersById.get(p.order_id) || {}).manager_name) === nameKey(m.name)).reduce((t, p) => t + Number(p.amount || 0), 0);
      return { name: m.name, collected, debt: mine.reduce((t, d) => t + d.rest, 0), count: mine.length, old: mine.filter((d) => d.days > OLD_DAYS).length };
    });
    // Promises for a day already gone, still unpaid — told once.
    const broken = [];
    for (const [m, v] of data.byManager) {
      for (const d of v.debts) {
        const st = data.state.get(d.order_id);
        if (!st || !st.promise_day || st.promise_day >= today || st.broken_day) continue;
        const c = data.customer.get(d.customer_id);
        broken.push({ who: c ? c.company || customerName(c) : d.title, rest: d.rest, promise_day: st.promise_day, manager: st.manager_name || m });
        await state.doc(d.order_id).set({ broken_day: today }, { merge: true });
      }
    }
    const text = summaryText(today, rows, broken);
    for (const chat of await admins()) await telegram("sendMessage", { chat_id: chat, text }).catch(() => undefined);
  };

  const workday = async (day) => new Date(`${day}T00:00:00Z`).getUTCDay() !== 0 && (await db.collection("holidays").where("date", "==", day).get()).empty;
  const once = async (day, field) =>
    db.runTransaction(async (tx) => {
      const ref = days.doc(day);
      const s = await tx.get(ref);
      if (s.exists && s.data()[field]) return false;
      tx.set(ref, { [field]: new Date().toISOString() }, { merge: true });
      return true;
    });
  const tick = async (now = Date.now()) => {
    const today = todayCode();
    if (today < START) return;
    const t = new Date(now + 5 * 3600e3);
    const min = t.getUTCHours() * 60 + t.getUTCMinutes();
    if (min < SEND_AT || !(await workday(today))) return;
    if (min < SUMMARY_AT) {
      if (await once(today, "sent")) await sendDay(today);
    } else if (await once(today, "summary")) await sendSummary(today);
  };

  const handleCallback = async (cq) => {
    const chatId = cq.message && cq.message.chat && cq.message.chat.id;
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) });
    const m = (cq.data || "").match(/^db:([paoPb]):([\w-]+)(?::(\d+))?$/);
    if (!m || !chatId) return answer();
    const [, act, id, arg] = m;
    const ref = state.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return answer("Topilmadi");
    const st = snap.data();
    if (Number(st.chat_id) !== Number(chatId)) return answer("Bu qarz boshqa menejerda");
    const edit = (text, markup) => telegram("editMessageText", { chat_id: chatId, message_id: cq.message.message_id, text, ...(markup ? { reply_markup: markup } : {}) });
    if (act === "p") return Promise.all([answer(), edit(`${st.text}\n\n🤝 Qachon to'lashga va'da berdi?`, promiseButtons(id))]);
    if (act === "b") return Promise.all([answer(), edit(st.text, buttons(id))]);
    const today = todayCode();
    const now = new Date().toISOString();
    let line;
    if (act === "P" && PROMISE[arg]) {
      const day = addDays(today, Number(arg));
      await ref.set({ promise_day: day, broken_day: null, last_result: "promise", last_at: now }, { merge: true });
      line = `🤝 Va'da: ${dayLabel(day)} — o'sha kuni yana eslataman`;
    } else if (act === "a") {
      await ref.set({ last_result: "noanswer", last_at: now }, { merge: true });
      line = "📵 Javob bermadi — ertaga yana chiqadi";
    } else if (act === "o") {
      await ref.set({ last_result: "paid", last_at: now }, { merge: true });
      line = `✅ To'lovni ERP'ga kiriting: ${SITE}/orders/${id}\nKiritilgach, qarz ro'yxatdan chiqadi.`;
    } else return answer();
    const label = act === "P" ? "Va'da yozildi" : act === "a" ? "Javob bermadi" : "To'ladi";
    const order = (await db.collection("orders").doc(id).get()).data() || {};
    if (order.customer_id) {
      const what = act === "P" ? `to'lashga va'da berdi — ${dayLabel(addDays(today, Number(arg)))}` : act === "a" ? "javob bermadi" : "to'laganini aytdi";
      await db.collection("customer_notes").add({ customer_id: order.customer_id, author_email: st.staff_email || "", author_name: st.manager_name || "", text: `💰 Qarz bo'yicha qo'ng'iroq (${dayLabel(today)}): ${what}`, created_at: now });
    }
    await answer(label);
    await edit(`${st.text}\n\n${line}`);
  };

  let timer = null;
  const start = () => {
    timer = setInterval(() => void tick().catch((err) => console.error("Debts tick failed", err.message)), TICK_MS);
    console.log(`Debts: daily lists from ${START}`);
  };
  const stop = () => clearInterval(timer);
  return { start, stop, tick, sendDay, sendSummary, handleCallback };
};

module.exports = { create, debtsByManager, dueToday, handedDay, debtText, summaryText, OLD_DAYS };
