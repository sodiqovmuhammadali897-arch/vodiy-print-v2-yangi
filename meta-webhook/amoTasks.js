// amoCRM tasks (zadachalar) → KPI. Pure helpers used by amocrm.js.
//
// A task counts in the month of its deadline: done by the deadline is "on
// time"; done later, or still open when the deadline passed, is "late".
// The server remembers every task it has seen open past its deadline
// (amo_task_misses/{YYYY-MM}), so moving the deadline afterwards does not
// clear it: it stays late in the month it was first missed.

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent
const WON = 142;
const LOST = 143;
const GRACE_MS = 60 * 1000;
const TYPES = { 1: "Qo'ng'iroq", 2: "Uchrashuv", 3: "Xat" };

const dayOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
const monthOf = (ms) => dayOf(ms).slice(0, 7);
const hmOf = (ms) => new Date(ms + TZ_OFFSET_MS).toISOString().slice(11, 16);

const toTask = (t) => ({
  id: Number(t.id),
  user: Number(t.responsible_user_id || 0),
  due: Number(t.complete_till || 0) * 1000,
  done: Boolean(t.is_completed),
  // amoCRM has no "completed at"; the last change of a done task is it.
  updated: Number(t.updated_at || t.created_at || 0) * 1000,
  text: String(t.text || "").slice(0, 200),
  type: Number(t.task_type_id || 0),
  entity: t.entity_type || null,
  entityId: Number(t.entity_id || 0) || null,
});

// Open tasks past their deadline that are not yet remembered as missed.
const newMisses = (tasks, misses, now) => {
  const out = [];
  for (const t of tasks) {
    if (t.done || !t.due || t.due > now - GRACE_MS || misses.has(t.id)) continue;
    out.push({ id: t.id, user: t.user, due: t.due, month: monthOf(t.due) });
  }
  return out;
};

const empty = () => ({ due: 0, on_time: 0, late: 0, pct: null, overdue_open: 0, today_due: 0, today_open: 0, no_task_leads: 0 });

// Per amoCRM user, the month's task numbers. `misses`: task id → { month }.
// Current-state counts (overdue now, today, leads without a task) only for
// the current month.
function computeTasks(month, { tasks, misses, leads = [], now }) {
  const by = new Map();
  const of = (u) => {
    if (!by.has(u)) by.set(u, empty());
    return by.get(u);
  };
  const isCurrent = monthOf(now) === month;
  const today = dayOf(now);
  for (const t of tasks) {
    const missed = misses.get(t.id);
    const home = missed ? missed.month : t.due ? monthOf(t.due) : null;
    if (home === month && (missed || t.done || t.due <= now)) {
      const s = of(t.user);
      s.due++;
      if (!missed && t.done && t.updated <= t.due + GRACE_MS) s.on_time++;
      else s.late++;
    }
    if (isCurrent && !t.done && t.due) {
      if (t.due <= now) of(t.user).overdue_open++;
      if (dayOf(t.due) === today) of(t.user).today_open++;
    }
    if (isCurrent && t.due && dayOf(t.due) === today) of(t.user).today_due++;
  }
  // Every open lead should have its next step: count those that have none.
  if (isCurrent) {
    const withTask = new Set(tasks.filter((t) => !t.done && t.entity === "leads").map((t) => t.entityId));
    for (const l of leads) {
      if (l.status === WON || l.status === LOST || l.status === -1 || !l.user) continue;
      if (!withTask.has(l.id)) of(l.user).no_task_leads++;
    }
  }
  for (const s of by.values()) s.pct = s.due ? Math.round((s.on_time / s.due) * 1000) / 10 : null;
  return by;
}

const label = (t, leadName) => {
  const what = t.text || TYPES[t.type] || "Zadacha";
  return leadName ? `${what} — «${leadName}»` : what;
};
const timeOf = (t) => {
  const hm = hmOf(t.due);
  return hm === "23:59" ? "" : `${hm} `;
};
const list = (tasks, leadName, max = 15) => {
  const lines = tasks.slice(0, max).map((t) => `• ${timeOf(t)}${label(t, leadName(t))}`);
  if (tasks.length > max) lines.push(`… yana ${tasks.length - max} ta`);
  return lines;
};

// 09:00 — today's tasks and what is already overdue.
function morningText(tasks, now, leadName) {
  const today = dayOf(now);
  const due = tasks.filter((t) => !t.done && t.due && dayOf(t.due) === today).sort((a, b) => a.due - b.due);
  const overdue = tasks.filter((t) => !t.done && t.due && dayOf(t.due) < today).sort((a, b) => a.due - b.due);
  if (!due.length && !overdue.length) return null;
  const out = [];
  if (due.length) out.push(`☀️ Bugungi amoCRM zadachalaringiz: ${due.length} ta`, ...list(due, leadName));
  if (overdue.length) out.push(...(out.length ? [""] : []), `⚠️ Muddati o'tgan: ${overdue.length} ta — bajarib qo'ying`, ...list(overdue, leadName, 5));
  return out.join("\n");
}

// 18:00 — what of today is still open.
function eveningText(tasks, now, leadName) {
  const today = dayOf(now);
  const todays = tasks.filter((t) => t.due && dayOf(t.due) === today);
  if (!todays.length) return null;
  const open = todays.filter((t) => !t.done).sort((a, b) => a.due - b.due);
  if (!open.length) return `✅ Bugungi ${todays.length} ta zadachaning hammasi bajarildi. Rahmat!`;
  return [`🌆 Bugun bajarilmay qolgan zadachalar: ${open.length} ta (${todays.length} tadan)`, ...list(open, leadName), "", "Muddatida bajarilmagan zadacha KPI'da kechikkan bo'lib hisoblanadi."].join("\n");
}

// 18:05 — one line per manager for the admin.
function adminText(rows) {
  if (!rows.length) return null;
  return ["📊 Bugun amoCRM zadachalari", ...rows.map((r) => `• ${r.name}: ${r.open ? `${r.open} ta qoldi` : "hammasi bajarildi ✅"} (${r.total} tadan)${r.noTask ? `, zadachasiz lid: ${r.noTask}` : ""}`)].join("\n");
}

module.exports = { toTask, newMisses, computeTasks, morningText, eveningText, adminText, dayOf, monthOf, hmOf };
