// "Moliyachi": yesterday's cash in/out, this month vs last month, total
// debt, biggest debtors and delivered-but-unpaid orders.
import {
  Report,
  bullets,
  dayCodeOf,
  daysBetween,
  esc,
  getDb,
  money,
  orderDebt,
  orderLabel,
  readAll,
  todayCode,
  yesterdayCode,
} from "./lib.mjs";

const r = new Report("💰 Moliyachi — kunlik hisobot");

if (!getDb()) {
  r.sections.push(r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan"));
  await r.send("TELEGRAM_FINANCE_CHAT_ID");
  process.exit(0);
}

const [orders, payments, expenses, customers] = await Promise.all([
  readAll("orders"),
  readAll("order_payments"),
  readAll("expenses"),
  readAll("customers"),
]);
const liveOrders = orders.filter((o) => o.status !== "cancelled" && !o.is_draft);
const sum = (items, field) => items.reduce((s, x) => s + Number(x[field] || 0), 0);
const payDay = (p) => dayCodeOf(p.payment_date || p.created_at);
const customerName = new Map(
  customers.map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.phone]),
);

await r.section("💵 Kecha", async () => {
  const paid = payments.filter((p) => payDay(p) === yesterdayCode);
  const spent = expenses.filter((e) => dayCodeOf(e.date || e.created_at) === yesterdayCode);
  const inSum = sum(paid, "amount");
  const outSum = sum(spent, "amount");
  const byType = new Map();
  for (const p of paid) byType.set(p.payment_type || "Boshqa", (byType.get(p.payment_type || "Boshqa") || 0) + Number(p.amount || 0));
  const lines = [`• Tushum: ${money(inSum)} (${paid.length} ta to'lov)`];
  if (byType.size > 0) lines.push(`   ${[...byType.entries()].map(([k, v]) => `${esc(k)}: ${money(v)}`).join(" · ")}`);
  lines.push(`• Xarajat: ${money(outSum)} (${spent.length} ta)`);
  lines.push(`• Sof: ${money(inSum - outSum)}`);
  return lines;
});

await r.section("📅 Shu oy", async () => {
  // This month so far vs the same number of days of last month, so the
  // comparison is fair on the 5th as much as on the 25th.
  const monthPrefix = todayCode.slice(0, 7);
  const dayOfMonth = Number(yesterdayCode.slice(8, 10));
  const lastMonth = new Date(Date.parse(`${monthPrefix}-01`) - 86400000).toISOString().slice(0, 7);
  const upTo = (prefix) => (p) => {
    const d = payDay(p);
    return d.startsWith(prefix) && Number(d.slice(8, 10)) <= dayOfMonth && d < todayCode;
  };
  if (todayCode.endsWith("-01")) return ["• Yangi oy bugun boshlandi"];
  const thisMonth = sum(payments.filter(upTo(monthPrefix)), "amount");
  const prevMonth = sum(payments.filter(upTo(lastMonth)), "amount");
  const spentMonth = sum(expenses.filter((e) => dayCodeOf(e.date || e.created_at).startsWith(monthPrefix)), "amount");
  const lines = [`• Tushum (1–${dayOfMonth}): ${money(thisMonth)}`];
  if (prevMonth > 0) {
    const pct = Math.round(((thisMonth - prevMonth) / prevMonth) * 100);
    const line = `O'tgan oyning shu davriga nisbatan: ${pct >= 0 ? "+" : ""}${pct}% (${money(prevMonth)})`;
    lines.push(pct < -20 ? r.warn(line) : `• ${line}`);
  }
  lines.push(`• Xarajat: ${money(spentMonth)}`);
  return lines;
});

await r.section("🧾 Qarzdorlik", async () => {
  const withDebt = liveOrders.filter((o) => orderDebt(o) > 0);
  const total = withDebt.reduce((s, o) => s + orderDebt(o), 0);
  const byCustomer = new Map();
  for (const o of withDebt) {
    const key = o.customer_id || `order:${o.id}`;
    byCustomer.set(key, (byCustomer.get(key) || 0) + orderDebt(o));
  }
  const top = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [`• Jami qarz: <b>${money(total)}</b> — ${byCustomer.size} ta mijoz, ${withDebt.length} ta buyurtma`];
  if (top.length > 0) {
    lines.push("• Eng katta qarzdorlar:");
    lines.push(
      ...bullets(top, 10, ([key, debt]) => {
        const name = key.startsWith("order:") ? "Mijozsiz buyurtma" : customerName.get(key) || "Noma'lum mijoz";
        return `${esc(name)} — ${money(debt)}`;
      }),
    );
  }
  return lines;
});

await r.section("🚚 Topshirilgan, lekin to'lanmagan", async () => {
  // Goods already handed over are the riskiest debt — nothing left to hold.
  const lastPayment = new Map();
  for (const p of payments) {
    const d = payDay(p);
    if (!lastPayment.has(p.order_id) || d > lastPayment.get(p.order_id)) lastPayment.set(p.order_id, d);
  }
  const risky = liveOrders
    .filter((o) => ["delivered", "closed"].includes(o.status) && !o.is_historical && orderDebt(o) > 0)
    .map((o) => ({ o, since: daysBetween(lastPayment.get(o.id) || dayCodeOf(o.completed_at || o.created_at), todayCode) }))
    .filter((x) => x.since >= 7)
    .sort((a, b) => orderDebt(b.o) - orderDebt(a.o));
  if (risky.length === 0) return [r.ok("Topshirilgan buyurtmalar bo'yicha 7 kundan ortiq to'lanmagan qarz yo'q")];
  const total = risky.reduce((s, x) => s + orderDebt(x.o), 0);
  return [
    r.warn(`${risky.length} ta buyurtma, ${money(total)} — 7+ kundan beri to'lov yo'q:`),
    ...bullets(risky, 8, ({ o, since }) =>
      [orderLabel(o), esc(customerName.get(o.customer_id) || o.title || "")].filter(Boolean).join(" ") +
        ` — ${money(orderDebt(o))}, ${since} kun (${esc(o.manager_name || "—")})`,
    ),
  ];
});

await r.send("TELEGRAM_FINANCE_CHAT_ID");
