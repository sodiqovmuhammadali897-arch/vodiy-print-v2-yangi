// Mois Zvonki calls → the ERP's CRM (phase 2, 2026-11-12). Pure helpers;
// server.js does the reads and writes.
//  - a call goes on the caller's OPEN lead: not lost, not one of the first
//    version's old leads (before CRM_START), and — if it became an order —
//    the order is not delivered, closed or cancelled;
//  - an incoming call with no open lead opens a new one (a repeat customer
//    too: a new enquiry);
//  - a missed incoming call puts a «call back» task on the lead's owner.
const CRM_START = "2026-11-12";
const CLOSED_ORDER = new Set(["delivered", "closed", "cancelled"]);

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "").slice(-9);

// leads: [{id, phone, status, created_at, converted_order_id}], orderStatus: id → status.
function pickOpenLead(leads, phone, orderStatus = {}) {
  const target = normalizePhone(phone);
  if (target.length < 9) return null;
  const open = leads.filter(
    (l) =>
      normalizePhone(l.phone) === target &&
      l.status !== "lost" &&
      String(l.created_at || "") >= CRM_START &&
      !(l.converted_order_id && CLOSED_ORDER.has(orderStatus[l.converted_order_id])),
  );
  open.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return open[0] || null;
}

// Who took or made the call. Mois Zvonki's call.finish (seen 2026-11-13)
// carries no e-mail: `user_name` (the employee as named in Mois Zvonki) and
// `src_number` (the employee's phone). `matchStaff` tries, in order: an
// e-mail in the event, the staff's «Mois Zvonki akkaunti» field equal to
// the e-mail / user_name / src_number, the staff's phone, the first name.
const normName = (s) => String(s || "").toLowerCase().replace(/[^a-zа-яё]/g, "").replace(/(.)\1+/g, "$1");
function matchStaff(event, staff) {
  const email = callStaffEmail(event);
  const user = String((event && event.user_name) || "").trim().toLowerCase();
  const src = normalizePhone(event && event.src_number);
  const keys = new Set([email, user, src].filter(Boolean));
  const field = (s) => String(s.moizvonki_email || "").trim().toLowerCase();
  const fieldDigits = (s) => normalizePhone(s.moizvonki_email);
  return (
    (email && staff.find((s) => String(s.id).toLowerCase() === email)) ||
    staff.find((s) => field(s) && (keys.has(field(s)) || (fieldDigits(s).length === 9 && fieldDigits(s) === src))) ||
    (src.length === 9 && staff.find((s) => normalizePhone(s.phone) === src)) ||
    (user && staff.find((s) => s.full_name && normName(String(s.full_name).split(/\s+/)[0]) === normName(user.split(/\s+/)[0]))) ||
    null
  );
}

function callStaffEmail(event) {
  for (const k of ["user_account", "user_email", "user_name", "user", "employee_email"]) {
    const v = event && event[k];
    if (typeof v === "string" && v.includes("@")) return v.trim().toLowerCase();
  }
  return "";
}

// Tashkent date and HH:MM `minutes` from now — the call-back deadline.
function dueIn(minutes, now = Date.now()) {
  const t = new Date(now + minutes * 60e3 + 5 * 3600e3).toISOString();
  return { due_date: t.slice(0, 10), due_time: t.slice(11, 16) };
}

// A missed call needs a call-back task unless an open call task is
// already there for today or earlier.
function needsCallback(openTasks, now = Date.now()) {
  const today = new Date(now + 5 * 3600e3).toISOString().slice(0, 10);
  return !openTasks.some((t) => t.status === "open" && (t.type === "call" || t.type === "follow_up") && String(t.due_date) <= today);
}

// Talk time of a call in seconds: answer → end when both came, else the
// event's duration (answered calls only).
function talkedSeconds(event) {
  if (!event || !event.answered) return 0;
  const a = Number(event.answer_time);
  const e = Number(event.end_time);
  if (a > 0 && e >= a) return Math.round(e - a);
  return Math.max(0, Math.round(Number(event.duration) || 0));
}

// Step 3 (2026-11-26): a real talk (30 s or more, in or out) does the
// lead's call tasks that are due today or earlier — the manager need not
// tick them by hand. Returns the tasks to close.
const TALK_MIN_S = 30;
function tasksDoneByTalk(tasks, seconds, now = Date.now()) {
  if (seconds < TALK_MIN_S) return [];
  const today = new Date(now + 5 * 3600e3).toISOString().slice(0, 10);
  return tasks.filter((t) => t.status === "open" && (t.type === "call" || t.type === "follow_up") && String(t.due_date || "") <= today);
}

const talkLabel = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)} daq ${sec % 60} s` : `${sec} s`);

module.exports = { CRM_START, pickOpenLead, callStaffEmail, matchStaff, dueIn, needsCallback, normalizePhone, talkedSeconds, tasksDoneByTalk, talkLabel, TALK_MIN_S };
