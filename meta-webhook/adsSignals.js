// Reklama 2.0, phase 4 — the agent's watch (the owner's TZ, «AI Targetolog
// Agent» table). ALERTS ONLY: it never pauses or changes a budget. Each
// signal says what it saw (numbers, period), why it matters and what to do.
// Pure: built from ads_days (last 30 days), ads_attr rows, account reach
// and the ads' review status. targetolog.js runs it after every full sync,
// keeps a cooldown per signal (ads_signals/{key}) and posts new ones to
// 🎯 Reklama between 08:00 and 22:00.

const DAY = 86400000;
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const som = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s ]/g, " ")} so'm`;
const pc = (x) => `${String(Math.round(x * 10) / 10).replace(".", ",")}%`;
const clip = (s, n = 50) => (String(s || "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ""));

// Sums of ad rows per id (c = campaign, s = ad set, a = ad) over days.
function sums(days, from, to, level) {
  const out = new Map();
  for (const d of days) {
    if (d.day < from || d.day > to) continue;
    for (const r of d.ads || []) {
      const id = r[level];
      if (!id) continue;
      const name = r[`${level}n`] || id;
      const x = out.get(id) || { id, name, cn: r.cn, spend: 0, impr: 0, link: 0, results: 0, erp: 0 };
      x.spend += r.spend;
      x.impr += r.impr;
      x.link += r.link;
      x.results += r.leads + r.chats;
      x.erp += r.erp || 0;
      out.set(id, x);
    }
  }
  return out;
}
const total = (days, from, to) => {
  let spend = 0;
  let results = 0;
  for (const d of days) if (d.day >= from && d.day <= to) {
    spend += d.totals?.spend || 0;
    results += d.totals?.results || 0;
  }
  return { spend, results, cpl: results ? spend / results : null };
};

// Hours each signal stays quiet after it was sent.
const COOLDOWN_H = { nores: 12, cpl: 24, ctr: 72, freq: 72, nosales: 168, good: 168, review: 24, api: 6 };

function signals({ days = [], attr = [], reach = null, adsStatus = [], today }) {
  const out = [];
  const d30 = total(days, addDays(today, -29), today);
  const avg = d30.cpl; // account lead price, 30 days
  const add = (s) => out.push({ level: "warn", ...s });

  // 1. Money without results today, per ad set.
  if (avg) {
    for (const s of sums(days, today, today, "s").values()) {
      if (s.results === 0 && s.spend >= Math.max(2 * avg, 50000))
        add({ key: `nores:${s.id}:${today}`, kind: "nores", level: "bad", title: `Pul ketyapti, natija yo'q: «${clip(s.name)}»`, evidence: `Bugun ${som(s.spend)} sarflandi, 0 ta lid (30 kunlik o'rtacha lid narxi ${som(avg)}).`, advice: "Reklama ko'rsatilayotgan joy va videoni tekshiring; kechgacha natija bo'lmasa — to'xtatishni o'ylab ko'ring." });
    }
  }

  // 2. Lead price jumped: last 3 days vs the campaign's own previous 27.
  if (avg) {
    const recent = sums(days, addDays(today, -2), today, "c");
    const before = sums(days, addDays(today, -29), addDays(today, -3), "c");
    for (const r of recent.values()) {
      const b = before.get(r.id);
      if (!b || !b.results || r.spend < 3 * avg) continue;
      const bCpl = b.spend / b.results;
      const rCpl = r.results ? r.spend / r.results : null;
      if (rCpl === null ? r.spend >= 3 * bCpl : rCpl >= 2 * bCpl && rCpl >= 1.5 * avg) {
        // What inside it got worse: the costliest video without results.
        const ads = [...sums(days, addDays(today, -2), today, "a").values()].filter((a) => a.cn === r.name).sort((x, y) => (y.results ? y.spend / y.results : y.spend * 10) - (x.results ? x.spend / x.results : x.spend * 10));
        const worst = ads[0];
        add({ key: `cpl:${r.id}`, kind: "cpl", level: "bad", title: `Lid narxi keskin oshdi: «${clip(r.name)}»`, evidence: `Oxirgi 3 kun: ${rCpl === null ? `${som(r.spend)}, lid yo'q` : `bitta lid ${som(rCpl)}`} — oldingi kunlarda ${som(bCpl)} edi (${rCpl === null ? "∞" : `${String(Math.round((rCpl / bCpl) * 10) / 10).replace(".", ",")}×`}).`, advice: `${worst ? `Eng qimmat video: «${clip(worst.name, 40)}» (${som(worst.spend)}, ${worst.results} lid). ` : ""}Video, joylashuv va auditoriyani tekshiring; lidlar sifatini Sotuv bo'limida ko'ring.` });
      }
    }
  }

  // 3. CTR dropped: an ad's last 3 days vs its previous 7.
  const ctrNow = sums(days, addDays(today, -2), today, "a");
  const ctrBefore = sums(days, addDays(today, -9), addDays(today, -3), "a");
  for (const n of ctrNow.values()) {
    const b = ctrBefore.get(n.id);
    if (!b || n.impr < 3000 || b.impr < 3000 || !b.link) continue;
    const now = n.link / n.impr;
    const was = b.link / b.impr;
    if (now <= was * 0.65)
      add({ key: `ctr:${n.id}`, kind: "ctr", title: `Odamlar kamroq bosyapti: «${clip(n.name)}»`, evidence: `CTR oxirgi 3 kunda ${pc(now * 100)} — oldingi haftada ${pc(was * 100)} edi (${n.impr.toLocaleString("ru-RU")} namoyish).`, advice: "Video eskirgan bo'lishi mumkin: yangi boshlanish (hook) yoki yangi video bilan sinab ko'ring." });
  }

  // 4. The audience is tired: the same people see it often and leads got dearer.
  if (reach && reach.d7 && reach.d7.reach > 0 && avg) {
    const freq = reach.d7.impr / reach.d7.reach;
    const r3 = total(days, addDays(today, -2), today);
    if (freq >= 2.5 && r3.cpl && r3.cpl >= 1.3 * avg)
      add({ key: "freq", kind: "freq", title: "Auditoriya charchagan bo'lishi mumkin", evidence: `7 kunda har bir odam reklamani o'rtacha ${String(Math.round(freq * 10) / 10).replace(".", ",")} marta ko'rgan; oxirgi 3 kun lid narxi ${som(r3.cpl)} (o'rtacha ${som(avg)}).`, advice: "Auditoriyani kengaytiring yoki yangi videolar qo'shing." });
  }

  // 5. Cheap leads, no sales: ≥10 ERP leads over two weeks old, no order.
  const byAd = new Map();
  for (const r of attr) {
    if (!r.a || r.day > addDays(today, -14) || r.day < addDays(today, -60)) continue;
    const x = byAd.get(r.a) || { leads: 0, ordered: 0 };
    x.leads++;
    if (r.orders) x.ordered++;
    byAd.set(r.a, x);
  }
  const names = new Map();
  for (const d of days) for (const r of d.ads || []) names.set(r.a, r.an);
  for (const [a, x] of byAd) {
    if (x.leads >= 10 && x.ordered === 0)
      add({ key: `nosales:${a}`, kind: "nosales", title: `Lid bor, sotuv yo'q: «${clip(names.get(a) || a)}»`, evidence: `2 haftadan oldin kelgan ${x.leads} ta liddan birortasi buyurtma bermagan (telefon bo'yicha).`, advice: "Shu lidlarga qo'ng'iroq qilinganini va mijoz telefoni to'g'ri kiritilganini tekshiring; lid sifati past bo'lsa — auditoriya yoki formani o'zgartiring." });
  }

  // 6. Working well: an ad set whose leads buy (ROAS ≥ 5).
  if (avg) {
    const set = sums(days, addDays(today, -29), today, "s");
    const sales = new Map();
    for (const r of attr) {
      if (!r.s || r.day < addDays(today, -29)) continue;
      const x = sales.get(r.s) || { revenue: 0, ordered: 0 };
      x.revenue += r.revenue;
      if (r.orders) x.ordered++;
      sales.set(r.s, x);
    }
    for (const [id, x] of sales) {
      const s = set.get(id);
      if (!s || !s.spend || x.ordered < 2) continue;
      const roas = x.revenue / s.spend;
      if (roas >= 5 && (!s.results || s.spend / s.results <= avg * 1.2))
        add({ key: `good:${id}`, kind: "good", level: "good", title: `Yaxshi ishlayapti: «${clip(s.name)}»`, evidence: `30 kunda ${som(s.spend)} sarf → ${x.ordered} ta mijoz buyurtma berdi, ${som(x.revenue)} savdo (ROAS ${String(Math.round(roas * 10) / 10).replace(".", ",")}×).`, advice: "Limit ichida shu auditoriyaga ko'proq budjet berish mumkin (qaror — sizniki)." });
    }
  }

  // 7. Meta rejected an ad or it has issues.
  for (const a of adsStatus) {
    if (["DISAPPROVED", "WITH_ISSUES"].includes(a.effective_status))
      add({ key: `review:${a.id}`, kind: "review", level: "bad", title: `Meta reklamani ${a.effective_status === "DISAPPROVED" ? "rad etdi" : "muammo bilan belgiladi"}: «${clip(a.name)}»`, evidence: `Holati: ${a.effective_status}.`, advice: "Ads Manager'da sababini ko'ring va reklamani tuzating." });
  }
  return out;
}

function signalsText(list) {
  const icon = { bad: "🔴", warn: "🟠", good: "🟢" };
  return ["🧠 Agent kuzatuvi (faqat xabar, budjetga tegmadim)", ...list.map((s) => `\n${icon[s.level] || "🟠"} ${s.title}\n${s.evidence}\n👉 ${s.advice}`)].join("\n");
}

module.exports = { signals, signalsText, COOLDOWN_H, sums };
