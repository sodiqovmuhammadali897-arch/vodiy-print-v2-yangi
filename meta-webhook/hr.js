// "HR agent" — watches attendance and nudges people:
// - at work start + 5 min (09:05 by default) everyone expected at work who
//   hasn't checked in gets a reminder;
// - whoever checks in late gets "N daqiqa kech qoldingiz".
// Each message goes to the employee's Telegram (free) when they linked the
// bot, otherwise by SMS through Eskiz.uz. Skips the weekly day off,
// holidays and approved leave. Every message is logged to hr_notifications
// and summarised in the report channel and on the AI Ofis page.
const crypto = require("crypto");
const { emitEvent } = require("./shared");
const { telegram } = require("./telegram");
const { staffFromRequest } = require("./auth");

const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL || "";
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD || "";
const ESKIZ_FROM = process.env.ESKIZ_FROM || "4546";
const SMS_ENABLED = Boolean(ESKIZ_EMAIL && ESKIZ_PASSWORD);
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const REMINDER_AFTER_MIN = 5;
// If the server comes up late (a deploy at noon), don't send the morning
// reminder hours after it would have made sense.
const REMINDER_WINDOW_MIN = 90;
const LATE_NOTICE_MAX_AGE_MS = 30 * 60 * 1000;
const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE = { workStart: "09:00", weeklyOffDay: 0 };

const tashkent = () => new Date(Date.now() + TZ_OFFSET_MS);
const dayCode = (d = tashkent()) => d.toISOString().slice(0, 10);
const hhmm = (iso) => new Date(Date.parse(iso) + TZ_OFFSET_MS).toISOString().slice(11, 16);
const firstName = (s) => String(s.full_name || s.email || "").trim().split(/\s+/)[0];
const minutesLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)} soat ${m % 60} daqiqa` : `${m} daqiqa`);

// Uzbek numbers typed any way ("90 123 45 67", "+998901234567") -> 998901234567
const normalizePhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) return `998${d}`;
  if (d.length === 12 && d.startsWith("998")) return d;
  return null;
};

// Exact wording matters: Eskiz only delivers texts matching templates
// approved in the Eskiz cabinet (see meta-webhook/README.md).
const reminderText = (s, workStart) =>
  `Hurmatli ${firstName(s)}, ish kuni soat ${workStart} da boshlandi. Siz hali ishga kelganingizni belgilamadingiz. Vodiy Print`;
const lateText = (s, minutes, at) =>
  `Hurmatli ${firstName(s)}, bugun ishga ${minutesLabel(minutes)} kech qoldingiz (kelgan vaqtingiz ${at}). Iltimos, vaqtida keling. Vodiy Print`;

// ── Eskiz.uz ─────────────────────────────────────────────────
let eskizToken = null;
const eskizLogin = async () => {
  const fd = new FormData();
  fd.append("email", ESKIZ_EMAIL);
  fd.append("password", ESKIZ_PASSWORD);
  const res = await fetch("https://notify.eskiz.uz/api/auth/login", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.token) throw new Error(`Eskiz login ${res.status}: ${data.message || ""}`);
  eskizToken = data.data.token;
};
const sendSms = async (phone, text) => {
  if (!eskizToken) await eskizLogin();
  const post = () => {
    const fd = new FormData();
    fd.append("mobile_phone", phone);
    fd.append("message", text);
    fd.append("from", ESKIZ_FROM);
    return fetch("https://notify.eskiz.uz/api/message/sms/send", { method: "POST", headers: { Authorization: `Bearer ${eskizToken}` }, body: fd });
  };
  let res = await post();
  if (res.status === 401) {
    await eskizLogin(); // token expired (30 days)
    res = await post();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Eskiz ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
};

const create = (db, { channelId }) => {
  let botUsername = "";
  let schedule = { ...DEFAULT_SCHEDULE };
  let scheduleAt = 0;
  let watchedDay = null;
  let unwatch = null;
  let timer = null;

  const loadSchedule = async () => {
    if (Date.now() - scheduleAt < 10 * 60 * 1000) return schedule;
    const snap = await db.collection("work_schedules").doc("default").get();
    schedule = { ...DEFAULT_SCHEDULE, ...(snap.exists ? snap.data() : {}) };
    scheduleAt = Date.now();
    return schedule;
  };

  const isWorkDay = async (code) => {
    const sched = await loadSchedule();
    if (new Date(`${code}T00:00:00Z`).getUTCDay() === Number(sched.weeklyOffDay)) return false;
    const hol = await db.collection("holidays").where("date", "==", code).get();
    return hol.empty;
  };

  const onLeave = async (code) => {
    const snap = await db.collection("leave_requests").where("status", "==", "approved").get();
    return new Set(snap.docs.map((d) => d.data()).filter((l) => l.fromDate <= code && code <= l.toDate).map((l) => String(l.employeeId).toLowerCase()));
  };

  // Telegram first (free, instant); SMS when the employee hasn't linked it.
  const notify = async (s, text, kind) => {
    let channel = null;
    let error = null;
    if (s.telegram_chat_id) {
      const r = await telegram("sendMessage", { chat_id: s.telegram_chat_id, text });
      if (r.ok) channel = "telegram";
      else error = r.description || "telegram failed";
    }
    const phone = normalizePhone(s.phone);
    if (!channel && phone && SMS_ENABLED) {
      try {
        await sendSms(phone, text);
        channel = "sms";
      } catch (err) {
        error = err.message;
      }
    }
    if (!channel && !error) error = s.telegram_chat_id || phone ? "SMS sozlanmagan" : "telefon ham Telegram ham yo'q";
    await db.collection("hr_notifications").add({
      email: s.email, name: s.full_name || s.email, kind, text, channel, phone: phone || "", status: channel ? "sent" : "failed",
      error: error || null, date: dayCode(), created_at: new Date().toISOString(),
    });
    return channel;
  };

  const staffList = async () => {
    const snap = await db.collection("staff").get();
    return snap.docs.map((d) => ({ email: d.id, ...d.data() })).filter((s) => s.attendance_notify !== false);
  };

  const channelPost = (text) => (channelId ? telegram("sendMessage", { chat_id: channelId, text }) : null);

  // ── 09:05 reminder ─────────────────────────────────────────
  const maybeRemind = async () => {
    const now = tashkent();
    const code = dayCode(now);
    const sched = await loadSchedule();
    const [h, m] = String(sched.workStart || "09:00").split(":").map(Number);
    const startMin = h * 60 + m;
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (nowMin < startMin + REMINDER_AFTER_MIN || nowMin > startMin + REMINDER_WINDOW_MIN) return;
    if (!(await isWorkDay(code))) return;
    // Claim today's run once, even across restarts.
    const run = db.collection("hr_runs").doc(code);
    try {
      await run.create({ started_at: new Date().toISOString() });
    } catch {
      return;
    }
    const [staff, att, leave] = await Promise.all([staffList(), db.collection("attendance").where("dateCode", "==", code).get(), onLeave(code)]);
    const arrived = new Set(att.docs.map((d) => d.data()).filter((r) => r.checkInTime).map((r) => String(r.employeeId).toLowerCase()));
    const missing = staff.filter((s) => !arrived.has(s.email) && !leave.has(s.email) && (s.telegram_chat_id || s.phone));
    const results = [];
    for (const s of missing) results.push({ s, channel: await notify(s, reminderText(s, sched.workStart), "reminder") });
    await run.update({ missing: missing.map((s) => s.email), sent: results.filter((r) => r.channel).length });
    if (missing.length === 0) {
      await emitEvent(db, { agent: "hr", kind: "report", text: `${sched.workStart}: hamma o'z vaqtida keldi`, bubble: "Hamma vaqtida keldi ✅", source: "schedule" });
      return;
    }
    const line = results.map((r) => `${r.s.full_name || r.s.email} (${r.channel === "sms" ? "SMS" : r.channel === "telegram" ? "Telegram" : "yuborilmadi"})`).join(", ");
    await channelPost(`🧑‍💼 HR · ${hhmm(new Date().toISOString())}\nHali ishga kelmaganlar (${missing.length}): ${line}`);
    await emitEvent(db, {
      agent: "hr", kind: "alert", source: "schedule",
      text: `${missing.length} kishi hali kelmadi: ${missing.map((s) => firstName(s)).join(", ")} — eslatma yuborildi`,
      bubble: `${missing.length} kishiga eslatma yubordim`,
    });
    console.log(`HR reminder ${code}: ${missing.length} missing`);
  };

  // ── late check-in notices ──────────────────────────────────
  const handleLate = async (docSnap) => {
    const r = docSnap.data();
    if (!r.checkInTime || !(Number(r.lateMinutes) > 0) || r.lateNotifiedAt) return;
    // Only fresh check-ins: never message people about this morning after a restart.
    const at = r.checkInTimestamp || r.createdAt;
    if (!at || Date.now() - Date.parse(at) > LATE_NOTICE_MAX_AGE_MS) return;
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(docSnap.ref)).data();
      if (!fresh || fresh.lateNotifiedAt) return false;
      tx.update(docSnap.ref, { lateNotifiedAt: new Date().toISOString() });
      return true;
    });
    if (!claimed) return;
    const email = String(r.employeeId || "").toLowerCase();
    const s = (await db.collection("staff").doc(email).get()).data();
    if (!s || s.attendance_notify === false) return;
    const staff = { email, ...s };
    const minutes = Number(r.lateMinutes);
    // checkInTime is already the Tashkent "HH:MM" the check-in function stored
    const came = /^\d{1,2}:\d{2}/.test(String(r.checkInTime)) ? String(r.checkInTime).slice(0, 5) : hhmm(at);
    const channel = await notify(staff, lateText(staff, minutes, came), "late");
    await channelPost(`🧑‍💼 HR · ${staff.full_name || email} ${minutesLabel(minutes)} kech keldi (${came})${channel ? ` — ${channel === "sms" ? "SMS" : "Telegram"} yuborildi` : ""}`);
    await emitEvent(db, {
      agent: "hr", kind: "alert", source: "schedule",
      text: `${staff.full_name || email} ${minutesLabel(minutes)} kech keldi (${came})`,
      bubble: `${firstName(staff)}: ${minutesLabel(minutes)} kech`,
    });
  };

  const watchToday = () => {
    const code = dayCode();
    if (watchedDay === code) return;
    if (unwatch) unwatch();
    watchedDay = code;
    unwatch = db.collection("attendance").where("dateCode", "==", code).onSnapshot(
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "removed") handleLate(ch.doc).catch((err) => console.error("HR late notice failed", err));
        }
      },
      (err) => console.error("HR attendance watch failed", err),
    );
  };

  const tick = async () => {
    try {
      watchToday();
      await maybeRemind();
    } catch (err) {
      console.error("HR tick failed", err);
    }
  };

  // ── linking an employee's Telegram ─────────────────────────
  const register = (app) => {
    app.post("/webhooks/hr/link", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who) return res.status(403).json({ error: "Kirish kerak" });
      if (!botUsername) return res.status(503).json({ error: "Bot hozir mavjud emas" });
      const code = crypto.randomBytes(9).toString("hex");
      await db.collection("tg_link_codes").doc(code).set({ email: who.email, created_at: new Date().toISOString() });
      res.json({ url: `https://t.me/${botUsername}?start=${code}` });
    });
  };

  const handlePrivateMessage = async (msg) => {
    const m = /^\/start\s+([a-f0-9]{18})$/.exec(msg.text.trim());
    if (!m) {
      await telegram("sendMessage", {
        chat_id: msg.chat.id,
        text: "Bu bot Vodiy Print xodimlariga davomat xabarlarini yuboradi. Ulash uchun saytdagi Davomat sahifasida «Telegram'ga ulash» tugmasini bosing.",
      });
      return;
    }
    const ref = db.collection("tg_link_codes").doc(m[1]);
    const link = (await ref.get()).data();
    if (!link || Date.now() - Date.parse(link.created_at) > LINK_CODE_TTL_MS) {
      await telegram("sendMessage", { chat_id: msg.chat.id, text: "Havola eskirgan. Saytdan «Telegram'ga ulash» tugmasini qaytadan bosing." });
      return;
    }
    await db.collection("staff").doc(link.email).set({ telegram_chat_id: msg.chat.id, telegram_linked_at: new Date().toISOString() }, { merge: true });
    await ref.delete();
    const s = (await db.collection("staff").doc(link.email).get()).data() || {};
    await telegram("sendMessage", { chat_id: msg.chat.id, text: `✅ ${firstName({ ...s, email: link.email })}, ulandingiz. Endi davomat xabarlari SMS o'rniga shu yerga keladi.` });
    console.log(`HR: linked Telegram for ${link.email}`);
  };

  const start = async () => {
    const me = await telegram("getMe", {});
    botUsername = me?.result?.username || "";
    await tick();
    timer = setInterval(tick, 30 * 1000);
    console.log(`HR agent started (bot @${botUsername || "?"}, SMS ${SMS_ENABLED ? "via Eskiz" : "off — Telegram only"})`);
  };

  const stop = () => {
    clearInterval(timer);
    if (unwatch) unwatch();
    unwatch = null;
    watchedDay = null;
  };

  return { register, start, stop, handlePrivateMessage, tick, _test: { reminderText, lateText, normalizePhone } };
};

module.exports = { create, normalizePhone, reminderText, lateText };
