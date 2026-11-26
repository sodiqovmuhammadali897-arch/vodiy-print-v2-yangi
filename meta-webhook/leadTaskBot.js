// Sotuv bo'limi, step 3 (2026-11-26): the ERP's lead tasks remind their
// manager in Telegram, like amoCRM's task pop-ups. When an open task's time
// comes the assignee gets «⏰ Zadacha vaqti bo'ldi» with the lead, its phone
// and four buttons; 30 minutes later, if still open, one «🔴 muddati o'tdi».
//   📞 Gaplashdim     — done; a «Qayta aloqa» tomorrow 10:00 if nothing else is open
//   📵 Javob bermadi  — done; a new call in 2 hours (working hours) if nothing else is open
//   ⏰ +1 soat / 📅 Ertaga — the task moves, the reminder comes again then
// Only staff ticked «Zadacha eslatmalari» in Xodimlar (bot_tasks.tasks)
// get them; only 08:00–20:00 Tashkent; tasks older than 12 hours are left
// to the page. TASK_REMINDERS=off stops it. Sent reminders are kept on the
// task (`reminded {due, late}`), so a restart never sends one twice.
const BT = require("./botTasks");

const TZ = 5 * 3600e3;
const MIN = 60e3;
const LATE_AFTER_MIN = 30;
const WINDOW_H = 12;
const OPEN_FROM = 8;
const OPEN_TO = 20;
const SITE = process.env.SITE_URL || "https://printvodiy.uz";

const TYPES = {
  call: ["📞", "Qo'ng'iroq qilish"],
  telegram: ["✈", "Telegramdan yozish"],
  send_price: ["💬", "Narx / taklif yuborish"],
  design_approval: ["📐", "Maket tasdiqlatish"],
  advance_reminder: ["💰", "Avansni eslatish"],
  follow_up: ["🔁", "Qayta aloqa"],
  ready_notice: ["📦", "Tayyorligini aytish"],
  other: ["•", "Boshqa"],
};
// The owner's names from Sotuv bo'limi → Sozlamalar (crm_settings/main
// .task_types), set by erpTasks.js when it reads the settings.
let custom = null;
const setTaskTypes = (list) => {
  custom = Array.isArray(list) && list.length ? new Map(list.filter((t) => t && t.key && t.label).map((t) => [t.key, [t.icon || "•", t.label]])) : null;
};
const typeInfo = (k) => (custom && custom.get(k)) || TYPES[k] || (custom ? ["•", "Zadacha"] : TYPES.other);

const hasTime = (t) => /^\d{2}:\d{2}$/.test(String(t.due_time || ""));
// When to remind: the due time; a task with no time — 09:00 that day.
const remindAt = (t) => Date.parse(`${t.due_date}T${hasTime(t) ? t.due_time : "09:00"}:00+05:00`);
const tashHour = (now) => new Date(now + TZ).getUTCHours();
const tashDay = (now) => new Date(now + TZ).toISOString().slice(0, 10);
const hm = (now) => new Date(now + TZ).toISOString().slice(11, 16);
const slot = (ms) => ({ due_date: tashDay(ms), due_time: hm(ms) });
const addDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tomorrowAt = (now, time = "10:00") => ({ due_date: addDay(tashDay(now), 1), due_time: time });

// A call `minutes` from now, moved to 10:00 when that falls outside 09–19.
function nextCallSlot(now, minutes = 120) {
  const at = now + minutes * MIN;
  const h = tashHour(at);
  if (h >= 19) return { due_date: addDay(tashDay(at), 1), due_time: "10:00" };
  if (h < 9) return { due_date: tashDay(at), due_time: "10:00" };
  return slot(at);
}

// Which reminder a task needs now: "due", "late" or null.
function reminderNow(t, now) {
  if (!t || t.status !== "open" || !t.assigned_to_email || !t.due_date) return null;
  const h = tashHour(now);
  if (h < OPEN_FROM || h >= OPEN_TO) return null;
  const at = remindAt(t);
  if (!Number.isFinite(at) || now < at || now - at > WINDOW_H * 3600e3) return null;
  const r = t.reminded || {};
  if (r.late) return null;
  // A task without a time is due by the end of the day — no «late» nudge.
  if (!hasTime(t)) return r.due ? null : "due";
  if (now - at >= LATE_AFTER_MIN * MIN) {
    // Never two messages in a row: the «due» one had its half hour.
    if (r.due && now - Date.parse(r.due) < 25 * MIN) return null;
    return "late";
  }
  return r.due ? null : "due";
}

const phoneLabel = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("998")) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return String(p || "");
};

function reminderText(kind, t, lead, now) {
  const [icon, label] = typeInfo(t.type);
  const at = remindAt(t);
  const late = Math.max(0, Math.round((now - at) / MIN));
  const who = lead ? [lead.full_name, lead.brand].filter((x) => x && x !== "Noma'lum").join(" · ") || t.lead_name || "Lid" : t.lead_name || "Lid";
  return [
    kind === "late" ? `🔴 Zadacha muddati o'tdi · ${hasTime(t) ? t.due_time : "bugun"} (${late < 60 ? `${late} daqiqa` : `${Math.floor(late / 60)} soat ${late % 60} daq`})` : `⏰ Zadacha vaqti bo'ldi · ${hasTime(t) ? t.due_time : "bugun"}`,
    `${icon} ${label}`,
    `👤 ${who}${lead && lead.lead_number ? ` (${lead.lead_number})` : ""}`,
    lead && lead.phone ? `☎️ ${phoneLabel(lead.phone)}` : "",
    t.note ? `📝 ${t.note}` : "",
    `🔗 ${SITE}/leads/${t.lead_id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const buttons = (taskId) => ({
  inline_keyboard: [
    [
      { text: "📞 Gaplashdim", callback_data: `lt:${taskId}:talk` },
      { text: "📵 Javob bermadi", callback_data: `lt:${taskId}:noans` },
    ],
    [
      { text: "⏰ +1 soat", callback_data: `lt:${taskId}:h1` },
      { text: "📅 Ertaga", callback_data: `lt:${taskId}:tom` },
    ],
  ],
});

// What a button does: pure, for tests. `othersOpen` = the lead has another
// open task, so no follow-up is added.
function plan(action, othersOpen, now) {
  if (action === "talk")
    return { done: "📞 Gaplashdim", line: "✅ Gaplashdi", follow: othersOpen ? null : { type: "follow_up", ...tomorrowAt(now), note: "Gaplashilgandan keyin: narx / maket yuborish yoki qayta qo'ng'iroq" } };
  if (action === "noans")
    return { done: "📵 Javob bermadi", line: "📵 Javob bermadi", follow: othersOpen ? null : { type: "call", ...nextCallSlot(now, 120), note: "Javob bermagan edi — yana qo'ng'iroq qiling" } };
  if (action === "h1") return { move: slot(now + 60 * MIN), line: "⏰ 1 soatga ko'chirildi" };
  if (action === "tom") return { move: tomorrowAt(now), line: "📅 Ertaga 10:00 ga ko'chirildi" };
  return null;
}

const create = (db, { telegram = require("./telegram").telegram, on = process.env.TASK_REMINDERS !== "off" } = {}) => {
  const staffMap = async () => new Map((await db.collection("staff").get()).docs.map((d) => [String(d.id).toLowerCase(), { id: d.id, ...d.data() }]));
  const active = (s) => s && s.active !== false && s.is_active !== false;

  const tick = async (now = Date.now()) => {
    const snap = await db.collection("lead_tasks").where("status", "==", "open").get();
    const due = snap.docs.map((d) => ({ ref: d.ref, t: { id: d.id, ...d.data() } })).map((x) => ({ ...x, kind: reminderNow(x.t, now) })).filter((x) => x.kind);
    if (!due.length) return 0;
    const staff = await staffMap();
    let sent = 0;
    for (const { ref, t, kind } of due) {
      const s = staff.get(String(t.assigned_to_email).toLowerCase());
      if (!active(s) || !s.telegram_chat_id || !BT.wants(s, "tasks")) continue;
      const iso = new Date(now).toISOString();
      // Marked first, so a failure or restart never repeats it.
      await ref.update(kind === "late" ? { "reminded.late": iso, ...(t.reminded && t.reminded.due ? {} : { "reminded.due": iso }) } : { "reminded.due": iso });
      const lead = (await db.collection("leads").doc(String(t.lead_id)).get()).data() || null;
      try {
        await telegram("sendMessage", { chat_id: Number(s.telegram_chat_id), text: reminderText(kind, t, lead, now), reply_markup: buttons(t.id), link_preview_options: { is_disabled: true } });
        sent++;
      } catch (err) {
        console.error("Task reminder failed", err.message);
      }
    }
    return sent;
  };

  const handleCallback = async (cq) => {
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text, show_alert: true } : {}) }).catch(() => undefined);
    const m = String(cq.data || "").match(/^lt:([\w-]+):(talk|noans|h1|tom)$/);
    if (!m) return answer();
    const [, taskId, action] = m;
    const userId = cq.from && cq.from.id;
    const found = (await db.collection("staff").where("telegram_chat_id", "in", [Number(userId), String(userId)]).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const s = found.find(active);
    if (!s) return answer("Telegram'ingiz ERP'dagi xodimga ulanmagan — rahbarga ayting");
    const ref = db.collection("lead_tasks").doc(taskId);
    const snap = await ref.get();
    const t = snap.exists ? { id: snap.id, ...snap.data() } : null;
    const msg = cq.message;
    const close = async (line) => {
      if (msg) await telegram("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: `${msg.text || ""}\n\n${line}`, reply_markup: { inline_keyboard: [] }, link_preview_options: { is_disabled: true } }).catch(() => undefined);
    };
    if (!t || t.status !== "open") {
      await answer("Bu zadacha allaqachon yopilgan");
      return close("☑️ Zadacha yopilgan");
    }
    const me = String(s.id).toLowerCase();
    if (s.role !== "admin" && String(t.assigned_to_email || "").toLowerCase() !== me) return answer("Bu zadacha sizniki emas");
    const now = Date.now();
    const iso = new Date(now).toISOString();
    const actor = { email: me, name: s.full_name || s.id };
    const others = (await db.collection("lead_tasks").where("lead_id", "==", String(t.lead_id)).get()).docs.some((d) => d.id !== t.id && d.data().status === "open");
    const p = plan(action, others, now);
    const log = (text) => db.collection("lead_activities").add({ lead_id: String(t.lead_id), text, actor_email: actor.email, actor_name: actor.name, created_at: iso });
    if (p.done) {
      await ref.update({ status: "done", completed_at: iso, result: `${p.done} (Telegram)` });
      await db.collection("leads").doc(String(t.lead_id)).update({ last_contact_at: iso, updated_at: iso }).catch(() => undefined);
      await log(`Zadacha bajarildi: ${typeInfo(t.type)[1]} — natija: ${p.done}`);
      if (p.follow) {
        await db.collection("lead_tasks").add({ lead_id: String(t.lead_id), lead_name: t.lead_name || "", type: p.follow.type, due_date: p.follow.due_date, due_time: p.follow.due_time, assigned_to_email: t.assigned_to_email || actor.email, assigned_to_name: t.assigned_to_name || actor.name, note: p.follow.note, status: "open", completed_at: null, created_at: iso });
        await log(`Zadacha qo'yildi: ${typeInfo(p.follow.type)[1]} — ${p.follow.due_date} ${p.follow.due_time}`);
      }
    } else {
      // Put off to a later day once its day had come: late in KPI (erpTasks.js).
      await ref.update({ ...p.move, reminded: {}, ...require("./erpTasks").missedOnMove(t, p.move.due_date, now) });
      await log(`Zadacha ko'chirildi: ${typeInfo(t.type)[1]} → ${p.move.due_date} ${p.move.due_time}`);
    }
    await answer();
    const next = p.follow ? ` · keyingisi: ${typeInfo(p.follow.type)[1].toLowerCase()} ${p.follow.due_date === tashDay(now) ? "bugun" : p.follow.due_date} ${p.follow.due_time}` : "";
    await close(`${p.line} · ${hm(now)}${next}`);
  };

  let timer = null;
  const start = () => {
    if (!on || timer) return;
    timer = setInterval(() => tick().catch((e) => console.error("Task reminders failed:", e.message)), 60e3);
  };
  return { tick, handleCallback, start };
};

module.exports = { create, reminderNow, reminderText, plan, nextCallSlot, remindAt, buttons, typeInfo, setTaskTypes };
