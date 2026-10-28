// Bitim nazorati: every open amoCRM deal should have its next step.
//
// At 10:00 (working days) each manager gets, by name, their open deals
// with no open task and the ones untouched for 3+ days; the admins get one
// line per manager. At 15:00 a manager who still has deals without a task
// gets those again. A deal closed as lost with no reason goes to the
// admins at once. Pure helpers here; amocrm.js sends (amo_meta/deal_alerts
// keeps what was sent).
const T = require("./amoTasks");

const WON = 142;
const LOST = 143;
const STALE_DAYS = 3;
const SHOW = 10;

const mln = (n) => {
  const v = Number(n) || 0;
  if (!v) return "";
  if (v >= 1e6) return `${(Math.round(v / 1e5) / 10).toString().replace(".", ",")} mln`;
  return `${Math.round(v / 1000)} ming`;
};
const isOpen = (l) => l.status !== WON && l.status !== LOST && l.status !== -1 && l.user;

// Per amoCRM user: { noTask: [...], stale: [...] }, biggest deals first.
function dealLists(leads, tasks, now, stageOf = () => "") {
  const withTask = new Set(tasks.filter((t) => !t.done && t.entity === "leads").map((t) => t.entityId));
  const by = new Map();
  const of = (u) => {
    if (!by.has(u)) by.set(u, { noTask: [], stale: [] });
    return by.get(u);
  };
  for (const l of leads) {
    if (!isOpen(l)) continue;
    const brief = { ...T.leadBrief(l, stageOf), idle: l.updated ? Math.floor((now - l.updated) / 86400000) : null };
    if (!withTask.has(l.id)) of(l.user).noTask.push(brief);
    if (l.updated && now - l.updated > STALE_DAYS * 86400000) of(l.user).stale.push(brief);
  }
  for (const s of by.values()) {
    s.noTask.sort((a, b) => b.price - a.price);
    s.stale.sort((a, b) => b.idle - a.idle || b.price - a.price);
  }
  return by;
}

const line = (d, withIdle) => `• ${d.name}${mln(d.price) ? ` — ${mln(d.price)}` : ""}${d.stage ? ` · ${d.stage}` : ""}${withIdle && d.idle !== null ? ` · ${d.idle} kun` : ""}`;
const list = (items, withIdle) => {
  const shown = items.slice(0, SHOW).map((d) => line(d, withIdle));
  if (items.length > SHOW) shown.push(`…va yana ${items.length - SHOW} ta`);
  return shown;
};

// The manager's message; `later` — the 15:00 one, only the deals still
// without a task. Null when there is nothing to say.
function managerText(name, s, later = false) {
  if (later) {
    if (!s.noTask.length) return null;
    return [`⏰ ${name}, hali ${s.noTask.length} ta bitimda keyingi vazifa yo'q:`, ...list(s.noTask), "", "amoCRM'da har biriga vazifa qo'ying — sana va nima qilinadi."].join("\n");
  }
  if (!s.noTask.length && !s.stale.length) return null;
  const out = [];
  if (s.noTask.length) out.push(`⚠️ ${name}, ${s.noTask.length} ta bitimda keyingi vazifa yo'q:`, ...list(s.noTask));
  if (s.stale.length) out.push(...(out.length ? [""] : []), `🕒 3 kundan beri harakatsiz — ${s.stale.length} ta:`, ...list(s.stale, true));
  out.push("", "amoCRM'da vazifa qo'ying yoki bitimni yangilang — ro'yxat o'zi yangilanadi.");
  return out.join("\n");
}

function adminText(rows) {
  const bad = rows.filter((r) => r.noTask || r.stale);
  if (!bad.length) return "✅ Bitimlar: hamma ochiq bitimda keyingi vazifa bor, 3 kundan ortiq harakatsiz bitim yo'q.";
  return ["📋 Bitim nazorati — 10:00", ...bad.map((r) => `${r.name} — vazifasiz ${r.noTask}, harakatsiz ${r.stale}`), "", "Ro'yxatlar menejerlarga yuborildi. Batafsil: Sotuv bo'limi → Nazorat."].join("\n");
}

// Deals closed as lost today with no reason written.
const lostNoReason = (leads, today) => leads.filter((l) => l.status === LOST && !l.loss && l.closed && T.dayOf(l.closed) === today);
const lostText = (l, manager) => `❌ Bitim yo'qotildi, sababi yozilmagan: ${l.name || `#${l.id}`}${mln(l.price) ? ` — ${mln(l.price)}` : ""}${manager ? ` · ${manager}` : ""}\namoCRM'da yo'qotish sababini tanlash kerak.`;

module.exports = { dealLists, managerText, adminText, lostNoReason, lostText, STALE_DAYS };
