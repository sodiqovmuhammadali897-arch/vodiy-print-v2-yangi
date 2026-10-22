// amoCRM calls in detail → the "Sotuv bo'limi · amoCRM hisobot" page and
// three Telegram notices. Pure helpers used by amocrm.js.
//
// A call is "answered" when it has a duration. People are counted by phone
// number (a hash of its last nine digits), leads by the lead the call is
// on — a call noted on a contact counts for that contact's latest lead.

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const WON = 142;
const LOST = 143;
const GAP_MS = 30 * 60 * 1000; // a pause between calls this long or longer
const MISSED_ALERT_MS = 15 * 60 * 1000;
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

const dayOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const hmOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(11, 16);
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;

// "1 s 05 daq", "12 daq", "40 son".
const talk = (sec) => {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s} son`;
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} s ${String(m % 60).padStart(2, "0")} daq` : `${m} daq`;
};
const waited = (ms) => talk(Math.max(0, ms) / 1000);

// The lead a call belongs to: its own lead, or the contact's lead changed
// most recently (open ones first).
const leadIndex = (leads) => {
  const byId = new Map();
  const byContact = new Map();
  for (const l of leads) {
    byId.set(l.id, l);
    if (!l.contact) continue;
    const had = byContact.get(l.contact);
    const open = (x) => x.status !== WON && x.status !== LOST;
    if (!had || (open(l) && !open(had)) || (open(l) === open(had) && l.updated > had.updated)) byContact.set(l.contact, l);
  }
  return (call) => {
    if (call.entity === "l") return byId.get(call.entityId) || null;
    if (call.entity === "c") return byContact.get(call.entityId) || null;
    return null;
  };
};

const emptyDay = () => ({
  first: null,
  last: null,
  total: 0,
  answered: 0,
  in: 0,
  out: 0,
  missed_in: 0,
  talk_sec: 0,
  longest: 0,
  talked: 0,
  leads_talked: 0,
  gaps: 0,
  hours: {},
});

// One manager's day from their calls (any order).
const summarizeDay = (calls) => {
  const d = emptyDay();
  const people = new Set();
  const leads = new Set();
  const sorted = [...calls].sort((a, b) => a.at - b.at);
  let prev = null;
  for (const c of sorted) {
    const hm = hmOf(c.at);
    if (!d.first) d.first = hm;
    d.last = hm;
    d.total++;
    d[c.dir]++;
    const h = hm.slice(0, 2);
    d.hours[h] = (d.hours[h] || 0) + 1;
    if (c.duration > 0) {
      d.answered++;
      d.talk_sec += c.duration;
      d.longest = Math.max(d.longest, c.duration);
      people.add(c.key);
      if (c.lead) leads.add(c.lead);
    } else if (c.dir === "in") d.missed_in++;
    if (prev && c.at - (prev.at + prev.duration * 1000) >= GAP_MS) d.gaps++;
    prev = c;
  }
  d.talked = people.size;
  d.leads_talked = leads.size;
  return d;
};

// Calls of a day per amoCRM user: Map user → day summary.
const byUserDay = (calls, day) => {
  const groups = new Map();
  for (const c of calls) {
    if (dayOf(c.at) !== day) continue;
    if (!groups.has(c.user)) groups.set(c.user, []);
    groups.get(c.user).push(c);
  }
  const out = new Map();
  for (const [user, list] of groups) out.set(user, summarizeDay(list));
  return out;
};

// Incoming calls of `day` nobody answered and nobody followed up yet (no
// later call with the same number, either way). Several missed calls from
// one number in a row are one request, timed from the first. `returned`
// lists those followed up, with how long it took.
const missedIncoming = (calls, day, now) => {
  const sorted = calls.filter((c) => dayOf(c.at) === day).sort((a, b) => a.at - b.at);
  const pending = new Map(); // number → first missed incoming call not followed up
  const returned = [];
  for (const c of sorted) {
    const p = pending.get(c.key);
    if (c.dir === "in" && c.duration === 0) {
      if (!p) pending.set(c.key, c);
      continue;
    }
    if (p) {
      returned.push({ ...p, back_after: c.at - p.at });
      pending.delete(c.key);
    }
  }
  const open = [...pending.values()].map((p) => ({ ...p, waiting: now - p.at }));
  return { open, returned };
};

// Today's new leads per responsible user: how many got a call, how fast
// the first one came, and which still wait.
const newLeads = (leads, calls, day, now, leadOf) => {
  const firstCall = new Map();
  for (const c of calls) {
    const l = leadOf(c);
    if (!l) continue;
    if (!firstCall.has(l.id) || c.at < firstCall.get(l.id)) firstCall.set(l.id, c.at);
  }
  const out = new Map();
  for (const l of leads) {
    if (typeof l.id !== "number" || dayOf(l.created) !== day) continue;
    if (!out.has(l.user)) out.set(l.user, { count: 0, called: 0, first_min_sum: 0, waiting: [] });
    const s = out.get(l.user);
    s.count++;
    const at = firstCall.get(l.id);
    if (at && at >= l.created - 60 * 1000) {
      s.called++;
      s.first_min_sum += Math.max(0, Math.round((at - l.created) / 60000));
    } else if (l.status !== WON && l.status !== LOST) {
      s.waiting.push({ id: l.id, name: l.name || "", source: l.source || "", created: hmOf(l.created), wait_min: Math.round((now - l.created) / 60000) });
    }
  }
  for (const s of out.values()) {
    s.avg_first_min = s.called ? Math.round(s.first_min_sum / s.called) : null;
    delete s.first_min_sum;
    s.waiting.sort((a, b) => b.wait_min - a.wait_min);
    s.waiting = s.waiting.slice(0, 20);
  }
  return out;
};

// ── Telegram texts ─────────────────────────────────────────

const missedText = (m, { manager, who, now }) =>
  [
    "📵 Javobsiz qo'ng'iroq qaytarilmadi",
    `${who || m.phone || "Noma'lum raqam"} — ${hmOf(m.at)} da qo'ng'iroq qilgan, ${waited(now - m.at)} o'tdi.`,
    manager ? `Menejer: ${manager}` : null,
    "Iltimos, hoziroq qayta qo'ng'iroq qiling.",
  ]
    .filter(Boolean)
    .join("\n");

const lateStartText = (names, day) =>
  names.length ? [`⏰ ${dayLabel(day)}, 09:30 — hali birorta qo'ng'iroq qilmagan menejerlar:`, ...names.map((n) => `• ${n}`)].join("\n") : null;

// 19:00 — the day in a few lines: the team, then one line per manager.
const daySummaryText = (day, rows, { missedOpen, newLeads: nl }) => {
  if (!rows.length) return null;
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const first = rows.map((r) => r.first).filter(Boolean).sort()[0];
  const lines = [
    `📊 Sotuv bo'limi · ${dayLabel(day)} · amoCRM`,
    `Qo'ng'iroq: ${sum("total")} (javob: ${sum("answered")}) · gaplashgan: ${sum("talked")} odam, ${sum("leads_talked")} lid`,
    `Suhbat: ${talk(sum("talk_sec"))}${first ? ` · ish boshlandi: ${first}` : ""}`,
  ];
  if (nl && nl.count) lines.push(`Yangi lidlar: ${nl.count}, qo'ng'iroq qilingan: ${nl.called}${nl.waiting ? ` · kutyapti: ${nl.waiting}` : ""}`);
  if (missedOpen) lines.push(`⚠️ Qaytarilmagan javobsiz qo'ng'iroq: ${missedOpen}`);
  lines.push("");
  for (const r of [...rows].sort((a, b) => b.talk_sec - a.talk_sec)) {
    lines.push(`• ${r.name}: ${r.first || "—"}–${r.last || "—"}, ${r.total} qo'ng'iroq, ${r.talked} odam, ${r.leads_talked} lid, ${talk(r.talk_sec)}${r.gaps ? `, tanaffus 30+: ${r.gaps}` : ""}`);
  }
  return lines.join("\n");
};

module.exports = { leadIndex, summarizeDay, byUserDay, missedIncoming, newLeads, missedText, lateStartText, daySummaryText, talk, dayOf, hmOf, dayLabel, MISSED_ALERT_MS, GAP_MS };
