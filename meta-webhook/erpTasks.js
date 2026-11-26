// Sotuv bo'limi, step 5 (2026-11-26): the ERP's own lead tasks take over
// what amoCRM's did — the KPI's task condition and the daily Telegram
// messages — once the owner makes the ERP the main system (Sotuv bo'limi →
// Tahlil → «amoCRM → ERP»; crm_settings/main.task_source = "erp").
//
// Always (both systems, for the comparison): every 30 minutes the month's
// numbers per seller go to erp_tasks/{YYYY-MM}_{email}, the same shape as
// amo_tasks (due, on_time, late, pct, overdue_open, today_due, …).
// A task counts in the month of its deadline: done by the deadline is on
// time; done later, or still open past it, is late. A task moved to a later
// day once its day had come (`missed`, set by the move) stays late in that
// month — as with amoCRM.
//
// Only when the ERP is main (amocrm.js then sends none of its own):
//   09:00 each seller's tasks for today, the overdue ones, leads without a task;
//   10:00 open leads without a task and untouched for 3+ days; admins a line each;
//   15:00 the leads still without a task;
//   18:00 what of today is still open; 18:05 the admins a line per seller.
// To staff ticked «amoCRM / kunlik eslatmalar» (bot_tasks.amo) with a linked
// Telegram; working days only for 10:00 / 15:00.
const BT = require("./botTasks");
const push = require("./push");

const TZ = 5 * 3600e3;
const CRM_START = "2026-11-12";
const GRACE = 60e3;
const STALE_DAYS = 3;
const STATS_EVERY = 30 * 60e3;
const SITE = process.env.SITE_URL || "https://printvodiy.uz";
const TYPES = { call: "Qo'ng'iroq qilish", telegram: "Telegramdan yozish", send_price: "Narx / taklif yuborish", design_approval: "Maket tasdiqlatish", advance_reminder: "Avansni eslatish", follow_up: "Qayta aloqa", ready_notice: "Tayyorligini aytish", other: "Zadacha" };
const MANUAL = new Set(["new", "accepted", "info_given", "offer", "telegram"]);

const dayOf = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
const hmOf = (ms) => new Date(ms + TZ).toISOString().slice(11, 16);
const nextDay = (day) => new Date(Date.parse(`${day}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
const dueAt = (t) => Date.parse(`${t.due_date}T${/^\d{2}:\d{2}$/.test(t.due_time || "") ? t.due_time : "23:59"}:00+05:00`);
const isOld = (l) => !l.amo_id && String(l.created_at || "") < CRM_START;
const key = (e) => String(e || "").trim().toLowerCase();
// An open lead whose next step is the seller's: not lost, no order yet.
const needsTask = (l) => l && !isOld(l) && l.status !== "lost" && !l.converted_order_id && MANUAL.has(l.status || "new");

const empty = () => ({ due: 0, on_time: 0, late: 0, pct: null, overdue_open: 0, past_open: 0, today_due: 0, today_open: 0, tomorrow_due: 0, postponed_today: 0, no_task_leads: 0 });

// A move of an open task to a later day once its day has come: it is late
// in the month of its old deadline. Pure; returns the fields to add, or {}.
function missedOnMove(task, newDate, now = Date.now()) {
  if (!task || task.status !== "open" || task.missed) return {};
  if (!task.due_date || task.due_date > dayOf(now) || !(newDate > task.due_date)) return {};
  return { missed: task.due_date.slice(0, 7), missed_at: new Date(now).toISOString() };
}

const brief = (l) => ({ id: l.id, name: l.brand || l.full_name || l.phone || l.lead_number || l.id, price: Number(l.estimated_amount) || 0, stage: l.status || "", number: l.lead_number || "" });

// Per seller (e-mail), the month's task numbers; the state right now only
// for the current month. Same fields as amoTasks.computeTasks.
function computeErpTasks(month, { tasks, leads, now }) {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const by = new Map();
  const of = (e) => {
    if (!by.has(e)) by.set(e, empty());
    return by.get(e);
  };
  const isCurrent = dayOf(now).slice(0, 7) === month;
  const today = dayOf(now);
  const tomorrow = nextDay(today);
  for (const t of tasks) {
    const who = key(t.assigned_to_email);
    const lead = leadById.get(t.lead_id);
    if (!who || !t.due_date || (lead && isOld(lead))) continue;
    const due = dueAt(t);
    const done = t.status === "done";
    const home = t.missed || t.due_date.slice(0, 7);
    if (home === month && (t.missed || done || due <= now)) {
      const s = of(who);
      s.due++;
      if (!t.missed && done && Date.parse(t.completed_at || "") <= due + GRACE) s.on_time++;
      else s.late++;
    }
    if (isCurrent && !done) {
      if (due <= now) of(who).overdue_open++;
      if (t.due_date < today) of(who).past_open++;
      if (t.due_date === today) of(who).today_open++;
    }
    if (isCurrent && t.due_date === today) of(who).today_due++;
    if (isCurrent && t.due_date === tomorrow) of(who).tomorrow_due++;
    if (isCurrent && t.missed_at && dayOf(Date.parse(t.missed_at)) === today) of(who).postponed_today++;
  }
  if (isCurrent) {
    const withTask = new Set(tasks.filter((t) => t.status === "open").map((t) => t.lead_id));
    for (const l of leads) {
      if (!needsTask(l) || !l.assigned_to_email || withTask.has(l.id)) continue;
      const s = of(key(l.assigned_to_email));
      s.no_task_leads++;
      (s.no_task_list = s.no_task_list || []).push(brief(l));
    }
    for (const s of by.values()) if (s.no_task_list) s.no_task_list = s.no_task_list.sort((a, b) => b.price - a.price).slice(0, 30);
  }
  for (const s of by.values()) s.pct = s.due ? Math.round((s.on_time / s.due) * 1000) / 10 : null;
  return by;
}

// Open leads without a task, and untouched for 3+ days, per seller.
function dealLists(leads, tasks, now) {
  const withTask = new Set(tasks.filter((t) => t.status === "open").map((t) => t.lead_id));
  const by = new Map();
  const of = (e) => {
    if (!by.has(e)) by.set(e, { noTask: [], stale: [] });
    return by.get(e);
  };
  for (const l of leads) {
    if (!needsTask(l) || !l.assigned_to_email) continue;
    const touched = Date.parse(l.last_contact_at || l.updated_at || l.created_at || "") || 0;
    const b = { ...brief(l), idle: touched ? Math.floor((now - touched) / 864e5) : null };
    const s = of(key(l.assigned_to_email));
    if (!withTask.has(l.id)) s.noTask.push(b);
    if (touched && now - touched > STALE_DAYS * 864e5) s.stale.push(b);
  }
  for (const s of by.values()) {
    s.noTask.sort((a, b) => b.price - a.price);
    s.stale.sort((a, b) => b.idle - a.idle || b.price - a.price);
  }
  return by;
}

const mln = (n) => (n >= 1e6 ? ` — ${String(Math.round(n / 1e5) / 10).replace(".", ",")} mln` : n ? ` — ${Math.round(n / 1000)} ming` : "");
const link = (id) => `${SITE}/leads?v=lidlar&lead=${id}`;
const taskLine = (t, lead) => `• ${t.due_time && t.due_time !== "23:59" ? `${t.due_time} ` : ""}${TYPES[t.type] || "Zadacha"} — «${(lead && (lead.brand || lead.full_name)) || t.lead_name || "lid"}»${t.note ? ` (${t.note})` : ""}`;
const cut = (lines, max) => (lines.length > max ? [...lines.slice(0, max), `… yana ${lines.length - max} ta`] : lines);

// 09:00 — today's tasks, the overdue ones, leads without a task.
function morningText(tasks, leadById, stats, now) {
  const today = dayOf(now);
  const open = tasks.filter((t) => t.status === "open");
  const due = open.filter((t) => t.due_date === today).sort((a, b) => dueAt(a) - dueAt(b));
  const overdue = open.filter((t) => t.due_date < today).sort((a, b) => dueAt(a) - dueAt(b));
  const out = [];
  if (due.length) out.push(`☀️ Bugungi zadachalaringiz: ${due.length} ta`, ...cut(due.map((t) => taskLine(t, leadById.get(t.lead_id))), 15));
  if (overdue.length) out.push(...(out.length ? [""] : []), `⚠️ Muddati o'tgan: ${overdue.length} ta — bajarib qo'ying`, ...cut(overdue.map((t) => taskLine(t, leadById.get(t.lead_id))), 5));
  if (stats && stats.no_task_leads) {
    const list = (stats.no_task_list || []).slice(0, 5);
    out.push(...(out.length ? [""] : []), `📌 Zadachasiz lidlar: ${stats.no_task_leads} ta — har biriga keyingi zadacha qo'ying:`, ...list.map((l) => `• ${l.name}${mln(l.price)}\n  ${link(l.id)}`));
  }
  return out.length ? out.join("\n") : null;
}

// 18:00 — what of today is still open.
function eveningText(tasks, leadById, now) {
  const today = dayOf(now);
  const todays = tasks.filter((t) => t.due_date === today);
  if (!todays.length) return null;
  const open = todays.filter((t) => t.status === "open").sort((a, b) => dueAt(a) - dueAt(b));
  if (!open.length) return `✅ Bugungi ${todays.length} ta zadachaning hammasi bajarildi. Rahmat!`;
  return [`🌆 Bugun bajarilmay qolgan zadachalar: ${open.length} ta (${todays.length} tadan)`, ...cut(open.map((t) => taskLine(t, leadById.get(t.lead_id))), 15), "", "Muddatida bajarilmagan zadacha KPI'da kechikkan bo'lib hisoblanadi."].join("\n");
}

// 10:00 / 15:00 — leads without a next step.
function dealText(name, s, later = false) {
  const line = (d, idle) => `• ${d.name}${mln(d.price)}${idle && d.idle !== null ? ` · ${d.idle} kun` : ""}`;
  if (later) {
    if (!s.noTask.length) return null;
    return [`⏰ ${name}, hali ${s.noTask.length} ta lidda keyingi zadacha yo'q:`, ...cut(s.noTask.map((d) => line(d)), 10), "", `ERP'da har biriga zadacha qo'ying: ${SITE}/leads?v=lidlar`].join("\n");
  }
  if (!s.noTask.length && !s.stale.length) return null;
  const out = [];
  if (s.noTask.length) out.push(`⚠️ ${name}, ${s.noTask.length} ta lidda keyingi zadacha yo'q:`, ...cut(s.noTask.map((d) => line(d)), 10));
  if (s.stale.length) out.push(...(out.length ? [""] : []), `🕒 3 kundan beri harakatsiz — ${s.stale.length} ta:`, ...cut(s.stale.map((d) => line(d, true)), 10));
  out.push("", `ERP'da zadacha qo'ying yoki lidni yangilang — ro'yxat o'zi yangilanadi: ${SITE}/leads?v=lidlar`);
  return out.join("\n");
}

const adminTasksText = (rows) => (rows.length ? ["📊 Bugun ERP zadachalari", ...rows.map((r) => `• ${r.name}: ${r.open ? `${r.open} ta qoldi` : "hammasi bajarildi ✅"} (${r.total} tadan)${r.noTask ? `, zadachasiz lid: ${r.noTask}` : ""}`)].join("\n") : null);
const adminDealsText = (rows) => {
  const bad = rows.filter((r) => r.noTask || r.stale);
  if (!bad.length) return "✅ Lidlar: hamma ochiq lidda keyingi zadacha bor, 3 kundan ortiq harakatsiz lid yo'q.";
  return ["📋 Lid nazorati — 10:00 (ERP)", ...bad.map((r) => `${r.name} — zadachasiz ${r.noTask}, harakatsiz ${r.stale}`), "", "Ro'yxatlar menejerlarga yuborildi. Batafsil: Sotuv bo'limi → Bosh sahifa."].join("\n");
};

const SLOTS = [
  { key: "morning", from: "09:00", to: "11:00" },
  { key: "deals_morning", from: "10:00", to: "12:00", workday: true },
  { key: "deals_afternoon", from: "15:00", to: "17:00", workday: true },
  { key: "evening", from: "18:00", to: "20:00" },
];

const create = (db, { telegram = null } = {}) => {
  let mainAt = 0;
  let main = false;
  // Is the ERP the main system now? (crm_settings/main.task_source)
  const erpIsMain = async () => {
    if (Date.now() - mainAt < 60e3) return main;
    const d = (await db.collection("crm_settings").doc("main").get()).data() || {};
    main = d.task_source === "erp";
    mainAt = Date.now();
    return main;
  };

  const load = async () => {
    const [tasks, leads, staff] = await Promise.all([db.collection("lead_tasks").get(), db.collection("leads").get(), db.collection("staff").get()]);
    return {
      tasks: tasks.docs.map((d) => ({ id: d.id, ...d.data() })),
      leads: leads.docs.map((d) => ({ id: d.id, ...d.data() })),
      staff: staff.docs.map((d) => ({ email: key(d.id), ...d.data() })),
    };
  };

  let statsAt = 0;
  const writeStats = async (now, data) => {
    const cur = dayOf(now).slice(0, 7);
    const prev = new Date(Date.UTC(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
    const names = new Map(data.staff.map((s) => [s.email, s.full_name || s.email]));
    for (const month of [prev, cur]) {
      for (const [email, s] of computeErpTasks(month, { ...data, now })) {
        await db.collection("erp_tasks").doc(`${month}_${email}`).set({ month, staff_email: email, name: names.get(email) || email, ...s, updated_at: new Date(now).toISOString() });
      }
    }
  };

  const send = async (s, text) => {
    if (!text) return;
    if (telegram && s.telegram_chat_id) await telegram("sendMessage", { chat_id: Number(s.telegram_chat_id), text, link_preview_options: { is_disabled: true } }).catch((e) => console.error("ERP task message failed", e.message));
    await push.toEmail(s.email, "amo", text, "/leads").catch(() => undefined);
  };
  const toAdmins = async (staff, text) => {
    if (!text) return;
    for (const s of staff.filter((x) => x.role === "admin" && !x.report_manager_id && x.telegram_chat_id)) if (telegram) await telegram("sendMessage", { chat_id: Number(s.telegram_chat_id), text }).catch(() => undefined);
    await push.toAdmins("admin", text, "/leads").catch(() => undefined);
  };

  // The slot due now and not sent today, or null (one small read).
  let sent = null;
  const dueSlot = async (now) => {
    const today = dayOf(now);
    const hm = hmOf(now);
    const open = SLOTS.filter((s) => hm >= s.from && hm < s.to);
    if (!open.length) return null;
    if (!sent || sent._day !== today) sent = { ...((await db.collection("crm_meta").doc("erp_messages").get()).data() || {}), _day: today };
    return open.find((s) => sent[s.key] !== today) || null;
  };

  const messages = async (now, data, slot) => {
    const today = dayOf(now);
    sent[slot.key] = today;
    await db.collection("crm_meta").doc("erp_messages").set({ [slot.key]: today }, { merge: true });
    if (slot.workday) {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      if (weekday === 0 || !(await db.collection("holidays").where("date", "==", today).get()).empty) return;
    }
    const leadById = new Map(data.leads.map((l) => [l.id, l]));
    const sellers = data.staff.filter((s) => s.active !== false && s.is_active !== false && !(s.role === "admin" && !s.report_manager_id) && BT.wants(s, "amo"));
    const stats = computeErpTasks(today.slice(0, 7), { ...data, now });
    const rows = [];
    if (slot.key === "morning" || slot.key === "evening") {
      for (const s of sellers) {
        const mine = data.tasks.filter((t) => key(t.assigned_to_email) === s.email && !(leadById.get(t.lead_id) && isOld(leadById.get(t.lead_id))));
        await send(s, slot.key === "morning" ? morningText(mine, leadById, stats.get(s.email), now) : eveningText(mine, leadById, now));
        const st = stats.get(s.email);
        if (slot.key === "evening" && st && st.today_due) rows.push({ name: s.full_name || s.email, total: st.today_due, open: st.today_open, noTask: st.no_task_leads });
      }
      if (slot.key === "evening") await toAdmins(data.staff, adminTasksText(rows));
      return;
    }
    const lists = dealLists(data.leads, data.tasks, now);
    for (const s of sellers) {
      const l = lists.get(s.email);
      if (!l) continue;
      rows.push({ name: s.full_name || s.email, noTask: l.noTask.length, stale: l.stale.length });
      await send(s, dealText(String(s.full_name || s.email).split(/\s+/)[0], l, slot.key === "deals_afternoon"));
    }
    if (slot.key === "deals_morning") await toAdmins(data.staff, adminDealsText(rows));
  };

  let busy = false;
  const tick = async (now = Date.now()) => {
    if (busy) return;
    busy = true;
    try {
      const slot = (await erpIsMain()) ? await dueSlot(now) : null;
      const statsDue = now - statsAt >= STATS_EVERY;
      if (!slot && !statsDue) return;
      const data = await load();
      if (statsDue) {
        statsAt = now;
        await writeStats(now, data);
      }
      if (slot) await messages(now, data, slot);
    } finally {
      busy = false;
    }
  };
  let timer = null;
  const start = () => {
    if (timer) return;
    setTimeout(() => tick().catch((e) => console.error("ERP tasks failed:", e.message)), 30e3);
    timer = setInterval(() => tick().catch((e) => console.error("ERP tasks failed:", e.message)), 60e3);
  };
  return { tick, start, erpIsMain };
};

module.exports = { create, computeErpTasks, dealLists, morningText, eveningText, dealText, missedOnMove, needsTask, adminTasksText, adminDealsText };
