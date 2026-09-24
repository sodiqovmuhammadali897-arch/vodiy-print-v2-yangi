// "Ishlab chiqarish nazoratchisi": overdue orders, what is due today and
// tomorrow, how many orders sit at each stage and which ones are stuck.
import {
  ORDER_STATUS_LABELS,
  Report,
  bullets,
  countBy,
  dayCodeOf,
  daysBetween,
  esc,
  getDb,
  orderLabel,
  readAll,
  todayCode,
  tomorrowCode,
  yEnd,
  yStart,
} from "./lib.mjs";

const r = new Report("🏭 Ishlab chiqarish nazoratchisi — kunlik hisobot");

if (!getDb()) {
  r.sections.push(r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan"));
  await r.send("TELEGRAM_PRODUCTION_CHAT_ID");
  process.exit(0);
}

const DONE = new Set(["delivered", "closed", "cancelled"]);
// How long an order may sit in one status before it counts as stuck.
const STUCK_AFTER_DAYS = { awaiting_advance: 3, design: 3, approving: 3 };
const DEFAULT_STUCK_DAYS = 5;

const [orders, history] = await Promise.all([readAll("orders"), readAll("order_status_history")]);
const active = orders.filter((o) => !DONE.has(o.status) && !o.is_draft && !o.is_historical);
const statusLabel = (s) => esc(ORDER_STATUS_LABELS[s] || s);
const who = (o) => esc(o.production_manager || o.manager_name || "—");

await r.section("🚨 Muddati o'tgan", async () => {
  const overdue = active
    .filter((o) => o.deadline && dayCodeOf(o.deadline) < todayCode)
    .map((o) => ({ o, late: daysBetween(dayCodeOf(o.deadline), todayCode) }))
    .sort((a, b) => b.late - a.late);
  if (overdue.length === 0) return [r.ok("Muddati o'tgan buyurtma yo'q")];
  return [
    r.fail(`${overdue.length} ta buyurtma muddatidan kechikmoqda:`),
    ...bullets(overdue, 10, ({ o, late }) => `${orderLabel(o)} ${esc(o.title || "")} — ${late} kun kech, ${statusLabel(o.status)} (${who(o)})`),
  ];
});

await r.section("📆 Topshirish yaqin", async () => {
  const due = (code) => active.filter((o) => o.deadline && dayCodeOf(o.deadline) === code);
  const notReady = (o) => !["ready", "ready_to_deliver"].includes(o.status);
  const lines = [];
  for (const [label, code] of [["Bugun", todayCode], ["Ertaga", tomorrowCode]]) {
    const list = due(code);
    if (list.length === 0) continue;
    const behind = list.filter(notReady);
    const head = `${label}: ${list.length} ta buyurtma, ${list.length - behind.length} tasi tayyor`;
    lines.push(behind.length > 0 && label === "Bugun" ? r.warn(head) : `• ${head}`);
    lines.push(...bullets(behind, 8, (o) => `${orderLabel(o)} ${esc(o.title || "")} — ${statusLabel(o.status)}`));
  }
  return lines.length > 0 ? lines : ["• Bugun va ertaga topshiriladigan buyurtma yo'q"];
});

await r.section("📊 Bosqichlar bo'yicha", async () => {
  const counts = new Map(countBy(active, (o) => o.status));
  const rows = Object.keys(ORDER_STATUS_LABELS)
    .filter((s) => counts.get(s))
    .map((s) => `   ${statusLabel(s)}: ${counts.get(s)}`);
  return [`• Jarayonda: ${active.length} ta buyurtma`, ...rows];
});

await r.section("🐢 Bir joyda qotib qolganlar", async () => {
  const lastChange = new Map();
  for (const h of history) {
    if (!lastChange.has(h.order_id) || h.changed_at > lastChange.get(h.order_id)) lastChange.set(h.order_id, h.changed_at);
  }
  // Overdue orders were already listed above; don't repeat them here.
  const isOverdue = (o) => o.deadline && dayCodeOf(o.deadline) < todayCode;
  const stuck = active
    .filter((o) => !isOverdue(o))
    .map((o) => ({ o, days: daysBetween(dayCodeOf(lastChange.get(o.id) || o.created_at), todayCode) }))
    .filter(({ o, days }) => days >= (STUCK_AFTER_DAYS[o.status] ?? DEFAULT_STUCK_DAYS))
    .sort((a, b) => b.days - a.days);
  if (stuck.length === 0) return [r.ok("Muddati hali o'tmagan, lekin bir bosqichda qotib qolgan buyurtma yo'q")];
  return [
    r.warn(`${stuck.length} ta buyurtma bosqichi uzoq vaqtdan beri o'zgarmagan:`),
    ...bullets(stuck, 8, ({ o, days }) => `${orderLabel(o)} ${esc(o.title || "")} — ${statusLabel(o.status)}, ${days} kun (${who(o)})`),
  ];
});

await r.section("✅ Kecha tayyor bo'lganlar", async () => {
  const doneYesterday = new Set(
    history
      .filter((h) => h.changed_at >= yStart && h.changed_at < yEnd && ["ready", "ready_to_deliver", "delivered"].includes(h.status))
      .map((h) => h.order_id),
  );
  return [`• ${doneYesterday.size} ta buyurtma tayyor bo'ldi yoki topshirildi`];
});

await r.send("TELEGRAM_PRODUCTION_CHAT_ID");
