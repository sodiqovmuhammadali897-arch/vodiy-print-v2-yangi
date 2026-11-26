// Sotuv bo'limi, step 6 (2026-11-26): what amoCRM's sync did for calls and
// lost deals, from the ERP's own data, for when the owner turns the amoCRM
// sync off (Tahlil → «amoCRM → ERP», crm_settings/main.amo_sync = false).
// Only then does this send anything — until then amocrm.js sends its own.
//
//   • a missed incoming call (Mois Zvonki → `calls`) nobody called back in
//     15 minutes → the lead's manager (else the managers' group, else the
//     admins), with the lead's link; the message closes itself when a later
//     call to that number appears; still not returned after an hour → the
//     admins once. 08:00–20:00, calls of the last two hours.
//   • 09:30 — sellers who called in the last two weeks but not yet today →
//     the admins (not on Sundays, holidays or approved leave).
//   • 19:00 — the day in short → the admins: calls, talks, talk time, first
//     and last call per seller, new leads, missed calls left; and the leads
//     lost today by reason and seller.
// State per day in crm_meta/erp_alerts_{day}.
const TZ = 5 * 3600e3;
const MIN = 60e3;
const SITE = process.env.SITE_URL || "https://printvodiy.uz";
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

const dayOf = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
const hmOf = (ms) => new Date(ms + TZ).toISOString().slice(11, 16);
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const digits = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const atOf = (c) => Date.parse(c.start_time || c.created_at || "") || 0;
const talkOf = (c) => {
  if (!c.answered) return 0;
  const a = Date.parse(c.answer_time || "");
  const e = Date.parse(c.end_time || "");
  return e > a ? Math.round((e - a) / 1000) : Math.max(0, Number(c.duration_seconds) || 0);
};
const talk = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} soat ${Math.round((sec % 3600) / 60)} daq` : `${Math.round(sec / 60)} daq`);
const waited = (ms) => (ms >= 3600e3 ? `${Math.floor(ms / 3600e3)} soat ${Math.round((ms % 3600e3) / MIN)} daqiqa` : `${Math.round(ms / MIN)} daqiqa`);
const missed = (c) => c.direction === "in" && !c.answered;

// The first call to/from the same number after a missed one: incoming
// answered, or any outgoing (an attempt counts — the customer may not pick up).
function followUpOf(calls, m) {
  const k = digits(m.phone);
  if (k.length < 9) return null;
  return calls.filter((c) => c.id !== m.id && digits(c.phone) === k && atOf(c) > atOf(m) && (c.direction === "out" || c.answered)).sort((a, b) => atOf(a) - atOf(b))[0] || null;
}
const followUpLine = (c) => (talkOf(c) > 0 ? `✅ Javob qaytarildi — ${hmOf(atOf(c))}, ${talk(talkOf(c))} gaplashildi` : `☎️ ${hmOf(atOf(c))} da qo'ng'iroq qilindi, mijoz ko'tarmadi — yana urinib ko'ring`);

// Missed calls to raise now: 15 min – 2 h old, not followed up, not raised yet.
function toRaise(calls, now, raised = {}) {
  return calls.filter((c) => missed(c) && digits(c.phone).length >= 9 && !raised[c.id] && now - atOf(c) >= 15 * MIN && now - atOf(c) <= 2 * 3600e3 && !followUpOf(calls, c));
}

// A day's calls per seller.
function byStaff(calls) {
  const by = new Map();
  for (const c of calls) {
    if (!c.staff_email) continue;
    const r = by.get(c.staff_email) || { total: 0, in: 0, out: 0, answered: 0, talked: 0, talk_sec: 0, first: null, last: null };
    r.total++;
    r[c.direction === "in" ? "in" : "out"]++;
    if (c.answered) r.answered++;
    const t = talkOf(c);
    if (t >= 30) r.talked++;
    r.talk_sec += t;
    const hm = hmOf(atOf(c));
    if (!r.first || hm < r.first) r.first = hm;
    if (!r.last || hm > r.last) r.last = hm;
    by.set(c.staff_email, r);
  }
  return by;
}

function daySummaryText(day, calls, names, { newLeads = 0, missedLeft = 0 } = {}) {
  const by = byStaff(calls);
  if (!by.size && !newLeads) return null;
  const rows = [...by.entries()].map(([email, r]) => ({ name: names.get(email) || email, ...r }));
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const lines = [
    `📊 Sotuv bo'limi · ${dayLabel(day)} · ERP`,
    `Qo'ng'iroq: ${sum("total")} (chiquvchi ${sum("out")}, kiruvchi ${sum("in")}) · gaplashildi (30 s+): ${sum("talked")}`,
    `Suhbat: ${talk(sum("talk_sec"))}`,
  ];
  if (newLeads) lines.push(`Yangi lidlar: ${newLeads}`);
  if (missedLeft) lines.push(`⚠️ Qaytarilmagan javobsiz qo'ng'iroq: ${missedLeft}`);
  if (rows.length) lines.push("");
  for (const r of rows.sort((a, b) => b.talk_sec - a.talk_sec)) lines.push(`• ${r.name}: ${r.first || "—"}–${r.last || "—"}, ${r.total} qo'ng'iroq, ${r.talked} suhbat, ${talk(r.talk_sec)}`);
  return lines.join("\n");
}

const lostAt = (l) => l.lost_at || l.updated_at || "";
function lostText(day, lostToday, monthLost = lostToday) {
  if (!lostToday.length) return null;
  const sum = lostToday.reduce((s, l) => s + (Number(l.estimated_amount) || 0), 0);
  const mln = (n) => `${String(Math.round(n / 1e5) / 10).replace(".", ",")} mln`;
  const count = (list, key) => {
    const m = new Map();
    for (const x of list) m.set(key(x), (m.get(key(x)) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const lines = [`📉 Bugun yo'qotilgan lidlar — ${dayLabel(day)}`, `Jami: ${lostToday.length} ta${sum ? ` · ${mln(sum)} so'm` : ""}`, "", "Sabablar:"];
  for (const [k, n] of count(lostToday, (l) => l.lost_reason || "Sabab yozilmagan")) lines.push(`• ${k} — ${n}`);
  lines.push("", "Menejerlar:");
  for (const [k, n] of count(lostToday, (l) => l.assigned_to_name || "Mas'ul yo'q")) lines.push(`• ${k} — ${n}`);
  lines.push("", `Oy boshidan: ${monthLost.length} ta yo'qotilgan lid. Batafsil: Sotuv bo'limi → Tahlil.`);
  return lines.join("\n");
}

const lateStartText = (names, day) => (names.length ? [`⏰ ${dayLabel(day)}, 09:30 — hali birorta qo'ng'iroq qilmagan menejerlar:`, ...names.map((n) => `• ${n}`)].join("\n") : null);

const missedText = (c, { who, manager, lead, now }) =>
  [
    "📵 Javobsiz qo'ng'iroq qaytarilmadi",
    `${who || c.phone || "Noma'lum raqam"} — ${hmOf(atOf(c))} da qo'ng'iroq qilgan, ${waited(now - atOf(c))} o'tdi.`,
    manager ? `Menejer: ${manager}` : null,
    "Iltimos, hoziroq qayta qo'ng'iroq qiling.",
    lead ? `🔗 ${SITE}/leads?v=lidlar&lead=${lead}` : null,
  ]
    .filter(Boolean)
    .join("\n");

const create = (db, { telegram = null, managersTarget = null, contacts = null } = {}) => {
  let flagAt = 0;
  let amoOff = false;
  const isAmoOff = async () => {
    if (Date.now() - flagAt < 60e3) return amoOff;
    flagAt = Date.now();
    amoOff = ((await db.collection("crm_settings").doc("main").get()).data() || {}).amo_sync === false;
    return amoOff;
  };
  const send = async (chat, text, extra = {}) => (telegram && chat ? telegram("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...extra }).catch(() => null) : null);
  const staffAll = async () => (await db.collection("staff").get()).docs.map((d) => ({ email: d.id.toLowerCase(), ...d.data() }));
  const admins = (staff) => staff.filter((s) => s.role === "admin" && !s.report_manager_id && s.telegram_chat_id);
  const toAdmins = async (staff, text) => {
    if (text) for (const s of admins(staff)) await send(Number(s.telegram_chat_id), text);
  };
  // Kontaktlar' calls (the office, staff, suppliers …) are not sales: left out.
  const callsSince = async (ms) => {
    const rows = (await db.collection("calls").where("created_at", ">=", new Date(ms).toISOString()).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const index = contacts ? await contacts.load().catch(() => new Map()) : new Map();
    return rows.filter((c) => !c.contact && !index.has(digits(c.phone)));
  };

  const tick = async (now = Date.now()) => {
    if (!(await isAmoOff())) return;
    const today = dayOf(now);
    const hm = hmOf(now);
    const stateRef = db.collection("crm_meta").doc(`erp_alerts_${today}`);
    const state = (await stateRef.get()).data() || {};
    const raised = state.raised || {};
    const dayStart = Date.parse(`${today}T00:00:00+05:00`);

    // Missed calls, 08:00–20:00.
    if (hm >= "08:00" && hm < "20:00") {
      const calls = await callsSince(Math.max(dayStart, now - 3 * 3600e3));
      const fresh = toRaise(calls, now, raised);
      const watching = Object.values(raised).some((r) => !r.done && !r.hour);
      const staff = fresh.length || watching ? await staffAll() : [];
      const byEmail = new Map(staff.map((s) => [s.email, s]));
      for (const c of fresh) {
        const lead = c.lead_id ? ((await db.collection("leads").doc(c.lead_id).get()).data() || null) : null;
        const owner = lead && lead.assigned_to_email ? byEmail.get(String(lead.assigned_to_email).toLowerCase()) : null;
        const text = missedText(c, { who: c.client_name || (lead && (lead.full_name || lead.brand)) || "", manager: owner ? owner.full_name : "", lead: c.lead_id, now });
        const target = owner && owner.telegram_chat_id ? { chat_id: Number(owner.telegram_chat_id) } : managersTarget ? await managersTarget() : null;
        const r = target ? await send(target.chat_id, text, target.message_thread_id ? { message_thread_id: target.message_thread_id } : {}) : null;
        if (!r) await toAdmins(staff, text);
        raised[c.id] = { at: now, chat: target ? target.chat_id : null, message_id: r && r.result ? r.result.message_id : null, text, manager: owner ? owner.full_name : "", who: c.client_name || "" };
        await stateRef.set({ raised: { [c.id]: raised[c.id] } }, { merge: true });
      }
      // Raised ones: closed when called back; an hour on → the admins once.
      for (const [id, r] of Object.entries(raised)) {
        if (r.done) continue;
        const c = calls.find((x) => x.id === id);
        const back = c && followUpOf(calls, c);
        if (back) {
          raised[id] = { ...r, done: true };
          await stateRef.set({ raised: { [id]: { done: true } } }, { merge: true });
          if (telegram && r.chat && r.message_id) await telegram("editMessageText", { chat_id: r.chat, message_id: r.message_id, text: `${r.text}\n\n${followUpLine(back)}`, link_preview_options: { is_disabled: true } }).catch(() => undefined);
        } else if (c && !r.hour && now - atOf(c) > 60 * MIN) {
          raised[id] = { ...r, hour: true };
          await stateRef.set({ raised: { [id]: { hour: true } } }, { merge: true });
          await toAdmins(staff, `📵 1 soatdan beri javob qaytarilmadi: ${r.who || c.phone || "noma'lum raqam"} (${hmOf(atOf(c))}) · ${r.manager || "menejer belgilanmagan"}`);
        }
      }
    }

    // 09:30 — no call yet.
    if (hm >= "09:30" && hm < "11:30" && !state.late_start) {
      await stateRef.set({ late_start: true }, { merge: true });
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      const holiday = !(await db.collection("holidays").where("date", "==", today).get()).empty;
      if (weekday !== 0 && !holiday) {
        const leave = await db.collection("leave_requests").where("status", "==", "approved").get();
        const away = new Set(leave.docs.map((d) => d.data()).filter((x) => x.fromDate <= today && today <= x.toDate).map((x) => String(x.employeeId).toLowerCase()));
        const two = await callsSince(now - 14 * 864e5);
        const callers = new Set(two.map((c) => c.staff_email).filter(Boolean));
        const todayCallers = new Set(two.filter((c) => atOf(c) >= dayStart).map((c) => c.staff_email));
        const staff = await staffAll();
        const names = staff.filter((s) => callers.has(s.email) && !todayCallers.has(s.email) && !away.has(s.email) && !(s.role === "admin" && !s.report_manager_id)).map((s) => s.full_name || s.email);
        await toAdmins(staff, lateStartText(names, today));
      }
    }

    // 19:00 — the day.
    if (hm >= "19:00" && hm < "21:00" && !state.summary) {
      await stateRef.set({ summary: true }, { merge: true });
      const [calls, staff, leads] = await Promise.all([callsSince(dayStart), staffAll(), db.collection("leads").get()]);
      const all = leads.docs.map((d) => ({ id: d.id, ...d.data() }));
      const names = new Map(staff.map((s) => [s.email, s.full_name || s.email]));
      const missedLeft = calls.filter((c) => missed(c) && digits(c.phone).length >= 9 && !followUpOf(calls, c)).length;
      const newLeads = all.filter((l) => dayOf(Date.parse(l.created_at || "")) === today).length;
      await toAdmins(staff, daySummaryText(today, calls, names, { newLeads, missedLeft }));
      const lost = all.filter((l) => l.status === "lost" && lostAt(l));
      await toAdmins(staff, lostText(today, lost.filter((l) => dayOf(Date.parse(lostAt(l))) === today), lost.filter((l) => dayOf(Date.parse(lostAt(l))).slice(0, 7) === today.slice(0, 7))));
    }
  };

  let timer = null;
  const start = () => {
    if (timer) return;
    timer = setInterval(() => tick().catch((e) => console.error("ERP daily alerts failed:", e.message)), 60e3);
  };
  return { tick, start, isAmoOff };
};

module.exports = { create, followUpOf, followUpLine, toRaise, byStaff, daySummaryText, lostText, lateStartText, missedText, talkOf };
