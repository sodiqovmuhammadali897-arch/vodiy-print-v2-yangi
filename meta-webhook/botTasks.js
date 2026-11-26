// What the bot gives each staff member — ticked by the owner in Xodimlar →
// «Bot unga nima bersin» (2026-11-24: «doim sanga qandaydir managerga
// buyruqlar beryapman, shuni xodimlar ruxsatiga belgidan qil»). Kept on
// staff.bot_tasks: { recall, recall_per_day, debts, leads, amo, tasks }.
// `tasks` (2026-11-26): the ERP lead tasks' Telegram reminders
// (leadTaskBot.js) — off until the owner ticks it.
//
// Before the owner ticks anything, a staff member keeps today's behaviour:
// old customers and debts go to the names in RECALL_MANAGERS, every staff
// member may take a lead, amoCRM reminders go to everyone linked.
// `migrate` writes that once onto staff without bot_tasks, so the form
// shows what really happens.

const KINDS = ["recall", "debts", "leads", "amo", "tasks"];
const norm = (s) => String(s || "").trim().toLowerCase();

const legacyNames = () =>
  (process.env.RECALL_MANAGERS || "")
    .split(",")
    .map(norm)
    .filter(Boolean);

// The staff member's own name or their Managerlar record's name.
const inLegacy = (s, managerName, names = legacyNames()) =>
  !names.length || names.includes(norm(managerName)) || names.includes(norm(s.full_name)) || names.includes(norm(String(s.full_name || "").split(/\s+/)[0]));

function wants(s, kind, { managerName = "", names } = {}) {
  const bt = (s && s.bot_tasks) || {};
  if (typeof bt[kind] === "boolean") return bt[kind];
  if (kind === "recall" || kind === "debts") return !!(s && s.report_manager_id) && inLegacy(s, managerName, names);
  if (kind === "tasks") return false; // new — only when ticked
  return true; // leads, amo — as before
}

function perDay(s, def) {
  const n = Number(s && s.bot_tasks && s.bot_tasks.recall_per_day);
  return n > 0 ? Math.min(200, Math.round(n)) : def;
}

// Today's behaviour written onto staff that have no bot_tasks yet.
function initial(s, managerName, def, names) {
  const out = {};
  for (const k of KINDS) out[k] = wants({ ...s, bot_tasks: {} }, k, { managerName, names });
  out.recall_per_day = def;
  return out;
}

async function migrate(db, def) {
  const staff = (await db.collection("staff").get()).docs;
  const managers = new Map((await db.collection("managers").get()).docs.map((d) => [d.id, d.data().name || ""]));
  let n = 0;
  for (const d of staff) {
    const s = d.data();
    if (s.bot_tasks && typeof s.bot_tasks === "object") continue;
    await d.ref.set({ bot_tasks: initial(s, managers.get(s.report_manager_id) || "", def) }, { merge: true });
    n++;
  }
  return n;
}

module.exports = { KINDS, wants, perDay, initial, migrate, inLegacy };
