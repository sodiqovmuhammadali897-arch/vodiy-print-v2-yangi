// Yutqazilganlar: the deals lost in amoCRM, by the day they were closed,
// with the reason the manager picked («Ёпилиш сабаби», see lossOf in
// amocrm.js), the stage the deal had reached and its sum.
//   • amo_lost/{YYYY-MM-DD} (admin read) — one doc per day since July
//     2026, for the «Yutqazilganlar» page (Sotuv bo'limi);
//   • 19:00 Tashkent — the day in short → the admins on Telegram: how many
//     said «qimmat», how many chose a competitor, per manager, and the
//     price/competitor deals worth trying again.

const LOST = 143;
const WON = 142;
const TZ_MS = 5 * 3600 * 1000;
const dayOf = (ms) => new Date(ms + TZ_MS).toISOString().slice(0, 10);

// Reason groups — the amoCRM options in Cyrillic Uzbek, plus Latin and
// amoCRM's own Russian ones. Anything else keeps its own name ("other").
const GROUPS = [
  { key: "price", title: "Qimmat", icon: "💸", re: /қиммат|qimmat|дорог/i },
  { key: "competitor", title: "Raqobatchi", icon: "🏁", re: /рақобат|raqobat|конкурент|других/i },
  { key: "no_answer", title: "Aloqa yo'q", icon: "📵", re: /алоқа|aloqa|не дозвон/i },
  { key: "wrong_number", title: "Xato raqam", icon: "☎️", re: /хато рақам|xato raqam|ишхона рақам|ishxona raqam/i },
  { key: "cancelled", title: "Bekor bo'ldi", icon: "🚫", re: /бекор|bekor|отмен|пропала/i },
];
const groupOf = (reason) => {
  if (!reason) return "none";
  const g = GROUPS.find((x) => x.re.test(reason));
  return g ? g.key : "other";
};
const ICON = { ...Object.fromEntries(GROUPS.map((g) => [g.key, g.icon])), other: "▫️", none: "❓" };

// The furthest open stage a deal was ever in (stage history from amoCRM
// events, else the stage it is in), by the pipeline's order.
function stageReached(l, history, statuses) {
  const keys = [...(history.get(l.id) || [])];
  let best = null;
  for (const k of keys) {
    const st = statuses[k];
    const status = Number(String(k).split(":")[1]);
    if (!st || status === WON || status === LOST) continue;
    if (!best || st.sort > best.sort) best = st;
  }
  return best ? best.name : "";
}

// Every lost deal closed from `fromMs` on, newest first.
function lostItems(leads, { fromMs = 0, history = new Map(), statuses = {}, nameOf = () => "" } = {}) {
  return leads
    .filter((l) => l.status === LOST && l.closed && l.closed >= fromMs)
    .map((l) => ({
      id: l.id,
      name: String(l.name || "").slice(0, 120),
      price: Number(l.price || 0),
      user: l.user || 0,
      manager: nameOf(l.user) || "",
      reason: l.loss || "",
      group: groupOf(l.loss),
      stage: stageReached(l, history, statuses),
      closed: new Date(l.closed).toISOString(),
      day: dayOf(l.closed),
    }))
    .sort((a, b) => b.closed.localeCompare(a.closed));
}

// One doc per day: the deals (biggest sum first) and counts by group.
function dayDocs(items) {
  const by = new Map();
  for (const it of items) {
    if (!by.has(it.day)) by.set(it.day, []);
    by.get(it.day).push(it);
  }
  const out = new Map();
  for (const [day, list] of by) {
    const counts = {};
    for (const it of list) counts[it.group] = (counts[it.group] || 0) + 1;
    out.set(day, {
      day,
      total: list.length,
      sum: list.reduce((s, it) => s + it.price, 0),
      counts,
      items: list
        .slice()
        .sort((a, b) => b.price - a.price || b.closed.localeCompare(a.closed))
        .map(({ day: _d, ...it }) => it),
    });
  }
  return out;
}

const mln = (n) => `${(Math.round((n / 1e6) * 10) / 10).toString().replace(".", ",")} mln`;
const pctOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;

// The 19:00 message. `today` and `month` are lists of lost items (month =
// from the 1st up to today). No message when nothing was lost.
function dailyText(day, today, month = today) {
  if (!today.length) return null;
  const sum = today.reduce((s, it) => s + it.price, 0);
  const lines = [`📉 Bugun yutqazilganlar — ${dayLabel(day)}`, `Jami: ${today.length} ta bitim${sum ? ` · ${mln(sum)} so'm` : ""}`, "", "Sabablar:"];

  // By reason as the manager picked it, biggest first; price and
  // competitor with their sums.
  const reasons = new Map();
  for (const it of today) {
    const k = it.reason || "Sabab tanlanmagan";
    const r = reasons.get(k) || { n: 0, sum: 0, group: it.group };
    r.n++;
    r.sum += it.price;
    reasons.set(k, r);
  }
  for (const [k, r] of [...reasons.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const withSum = (r.group === "price" || r.group === "competitor") && r.sum;
    lines.push(`${ICON[r.group]} ${k} — ${r.n}${withSum ? `  (${mln(r.sum)})` : ""}`);
  }

  lines.push("", "Menejerlar:");
  const byManager = new Map();
  for (const it of today) {
    const k = it.manager || "Mas'ul yo'q";
    const m = byManager.get(k) || { n: 0, price: 0, competitor: 0 };
    m.n++;
    if (it.group === "price") m.price++;
    if (it.group === "competitor") m.competitor++;
    byManager.set(k, m);
  }
  for (const [k, m] of [...byManager.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const extra = [m.price && `qimmat ${m.price}`, m.competitor && `raqobatchi ${m.competitor}`].filter(Boolean).join(", ");
    lines.push(`${k} — ${m.n}${extra ? ` (${extra})` : ""}`);
  }

  const back = today.filter((it) => it.group === "price" || it.group === "competitor").sort((a, b) => b.price - a.price);
  if (back.length) {
    lines.push("", "💸🏁 Qimmat / raqobatchi — qaytarsa bo'ladi:");
    back.slice(0, 8).forEach((it, i) => lines.push(`${i + 1}. ${it.name || `#${it.id}`}${it.price ? ` — ${mln(it.price)}` : ""} · ${it.manager || "—"} · ${ICON[it.group]}`));
    if (back.length > 8) lines.push(`…yana ${back.length - 8} ta — saytda`);
  }

  const mp = month.filter((it) => it.group === "price").length;
  const mc = month.filter((it) => it.group === "competitor").length;
  lines.push("", `Oy boshidan: ${month.length} ta · qimmat ${pctOf(mp, month.length)}% · raqobatchi ${pctOf(mc, month.length)}%`);
  return lines.join("\n");
}

module.exports = { GROUPS, groupOf, stageReached, lostItems, dayDocs, dailyText, dayLabel };
