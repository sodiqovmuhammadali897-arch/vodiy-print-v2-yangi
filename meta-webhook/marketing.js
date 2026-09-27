// Marketolog agent: weekly marketing report every Monday 09:00 (Tashkent)
// into the "📣 Marketing" topic of the work group, and answers to anything
// asked in that topic.
//
// The report is four messages:
//   1. the numbers (computed here, never by the model) — leads by source
//      and how many became orders, revenue by source, new vs returning
//      customers, top products with margin, ad spend → cost per lead/customer;
//   2. Meta ads per campaign (when META_ADS_TOKEN + META_AD_ACCOUNT_ID are set);
//   3. what to do — recommendations and the week's content plan (Claude,
//      from the numbers, the catalog and the upcoming holidays);
//   4. customers to win back (60+ days without an order) with a ready
//      personal message for each.
const { telegram } = require("./telegram");
const { staffFromRequest } = require("./auth");
const { emitEvent, clip, money, todayCode, dayCodeOf, customerName, norm } = require("./shared");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5";
const ADS_TOKEN = process.env.META_ADS_TOKEN || "";
const AD_ACCOUNT = (process.env.META_AD_ACCOUNT_ID || "").replace(/^act_/, "");
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

// A lead counts as won once it reached the advance stage or got an order.
const WON = new Set(["advance", "design", "production", "ready", "delivered"]);
const DORMANT_DAYS = 60;
const REPORT_HOUR = 9;
const AD_CATEGORY = "Reklama";

// Fixed-date occasions people order printing and gifts for. Moving ones
// (hayitlar) come from the ERP's own holidays list (Sozlamalar → Bayramlar).
const OCCASIONS = [
  ["01-01", "Yangi yil"],
  ["01-14", "Vatan himoyachilari kuni"],
  ["02-14", "14-fevral"],
  ["03-08", "8-mart, Xalqaro xotin-qizlar kuni"],
  ["03-21", "Navro'z"],
  ["05-09", "Xotira va qadrlash kuni"],
  ["06-01", "Bolalarni himoya qilish kuni"],
  ["06-27", "Matbuot va OAV xodimlari kuni"],
  ["09-01", "Mustaqillik kuni"],
  ["09-02", "Yangi o'quv yili"],
  ["10-01", "O'qituvchi va murabbiylar kuni"],
  ["10-21", "O'zbek tili bayrami"],
  ["12-08", "Konstitutsiya kuni"],
  ["12-20", "Yil yakuni: korporativ sovg'alar, kalendarlar, bloknotlar"],
];

const shiftDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const human = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const trend = (now, before) => {
  if (!before) return now ? " (o'tgan hafta 0)" : "";
  const d = Math.round(((now - before) / before) * 100);
  return d === 0 ? " (o'zgarmadi)" : ` (${d > 0 ? "▲" : "▼"}${Math.abs(d)}%)`;
};

// Splits long text at line breaks into Telegram-sized messages.
const chunks = (text, size = 3900) => {
  const out = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > size && cur) {
      out.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
};

// ── data ─────────────────────────────────────────────────────────────
const create = (db, { route = null } = {}) => {
  const read = async (col) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  const load = async () => {
    const [leads, orders, lines, customers, expenses, products, costs, holidays] = await Promise.all([
      read("leads"),
      read("orders"),
      read("order_products"),
      read("customers"),
      read("expenses"),
      read("products"),
      read("product_costs").catch(() => []),
      read("holidays").catch(() => []),
    ]);
    const live = orders.filter((o) => o.status !== "cancelled" && !o.is_draft);
    return { leads, orders: live, lines, customers, expenses, products, costs, holidays };
  };

  const orderDay = (o) => dayCodeOf(o.order_date || o.created_at);

  // Unit cost of a product at a quantity from its cost tiers (admin-only
  // product_costs), matched to the order line by product name.
  const costIndex = (products, costs) => {
    const byId = new Map(costs.map((c) => [c.id, c.cost_tiers || []]));
    const byName = new Map();
    for (const p of products) if (byId.get(p.id)?.length) byName.set(norm(p.name), byId.get(p.id));
    return (name, qty) => {
      const tiers = [...(byName.get(norm(name)) || [])].sort((a, b) => a.min_qty - b.min_qty);
      if (!tiers.length) return null;
      let cost = tiers[0].cost_price;
      for (const t of tiers) if (qty >= t.min_qty) cost = t.cost_price;
      return Number(cost) || null;
    };
  };

  const stats = (data, from, to) => {
    const inRange = (d) => d && d >= from && d <= to;
    const leads = data.leads.filter((l) => inRange(dayCodeOf(l.created_at)));
    const won = (l) => WON.has(l.status) || Boolean(l.converted_order_id);

    const bySource = new Map();
    for (const l of leads) {
      const k = l.source || "Noma'lum";
      const s = bySource.get(k) || { manba: k, lidlar: 0, buyurtma: 0, yoqotilgan: 0 };
      s.lidlar++;
      if (won(l)) s.buyurtma++;
      if (l.status === "lost") s.yoqotilgan++;
      bySource.set(k, s);
    }
    const sources = [...bySource.values()].sort((a, b) => b.lidlar - a.lidlar).map((s) => ({ ...s, konversiya: pct(s.buyurtma, s.lidlar) }));

    const lostReasons = new Map();
    for (const l of leads.filter((x) => x.status === "lost")) lostReasons.set(l.lost_reason || "sabab yozilmagan", (lostReasons.get(l.lost_reason || "sabab yozilmagan") || 0) + 1);

    const responses = leads
      .filter((l) => l.first_contact_at)
      .map((l) => (Date.parse(l.first_contact_at) - Date.parse(l.created_at)) / 3600000)
      .filter((h) => h >= 0)
      .sort((a, b) => a - b);
    const median = responses.length ? responses[Math.floor(responses.length / 2)] : null;

    // Orders and customers
    const firstOrder = new Map();
    for (const o of data.orders) {
      if (!o.customer_id) continue;
      const d = orderDay(o);
      if (!firstOrder.has(o.customer_id) || d < firstOrder.get(o.customer_id)) firstOrder.set(o.customer_id, d);
    }
    const orders = data.orders.filter((o) => inRange(orderDay(o)));
    const revenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const customersIn = new Set(orders.map((o) => o.customer_id).filter(Boolean));
    const newCustomers = [...customersIn].filter((id) => inRange(firstOrder.get(id))).length;

    const bySrcRev = new Map();
    for (const o of orders) {
      const k = o.customer_source || "ko'rsatilmagan";
      const s = bySrcRev.get(k) || { manba: k, buyurtmalar: 0, summa: 0 };
      s.buyurtmalar++;
      s.summa += Number(o.total_amount || 0);
      bySrcRev.set(k, s);
    }

    // Products: revenue and, where cost is known, margin
    const ids = new Set(orders.map((o) => o.id));
    const unitCost = costIndex(data.products, data.costs);
    const byProduct = new Map();
    for (const l of data.lines.filter((x) => ids.has(x.order_id))) {
      const k = norm(l.product_name) || "—";
      const p = byProduct.get(k) || { nomi: l.product_name || "—", soni: 0, summa: 0, tannarx: 0, tannarx_malum: true };
      const qty = Number(l.quantity || 0);
      p.soni += qty;
      p.summa += Number(l.total || 0);
      const c = unitCost(l.product_name, qty);
      if (c === null) p.tannarx_malum = false;
      else p.tannarx += c * qty;
      byProduct.set(k, p);
    }
    const products = [...byProduct.values()]
      .sort((a, b) => b.summa - a.summa)
      .slice(0, 8)
      .map((p) => ({
        nomi: p.nomi,
        soni: p.soni,
        summa: money(p.summa),
        foyda: p.tannarx_malum && p.summa ? `${money(p.summa - p.tannarx)} (${Math.round(((p.summa - p.tannarx) / p.summa) * 100)}%)` : "tannarx kiritilmagan",
      }));

    const adSpend = data.expenses
      .filter((e) => e.category === AD_CATEGORY && inRange(dayCodeOf(e.date || e.created_at)))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    const avgResponse = median === null ? null : median < 1 ? `${Math.round(median * 60)} daqiqa` : `${Math.round(median * 10) / 10} soat`;
    return {
      davr: `${from} — ${to}`,
      lidlar: leads.length,
      lid_buyurtmaga: leads.filter(won).length,
      lid_konversiya: pct(leads.filter(won).length, leads.length),
      yoqotilgan: leads.filter((l) => l.status === "lost").length,
      yoqotish_sabablari: Object.fromEntries([...lostReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)),
      birinchi_javob_mediana: avgResponse,
      manbalar: sources,
      buyurtmalar: orders.length,
      tushum: money(revenue),
      tushum_raqam: revenue,
      ortacha_chek: money(orders.length ? revenue / orders.length : 0),
      mijozlar: customersIn.size,
      yangi_mijozlar: newCustomers,
      qaytgan_mijozlar: customersIn.size - newCustomers,
      tushum_manba_boyicha: [...bySrcRev.values()].sort((a, b) => b.summa - a.summa).map((s) => ({ ...s, summa: money(s.summa) })),
      top_mahsulotlar: products,
      reklama_xarajati: money(adSpend),
      reklama_raqam: adSpend,
      bir_lid_narxi: adSpend && leads.length ? money(adSpend / leads.length) : null,
      bir_mijoz_narxi: adSpend && newCustomers ? money(adSpend / newCustomers) : null,
    };
  };

  const dormant = (data, days = DORMANT_DAYS, limit = 10) => {
    const today = todayCode();
    const per = new Map();
    for (const o of data.orders) {
      if (!o.customer_id) continue;
      const c = per.get(o.customer_id) || { last: "", total: 0, count: 0, orders: [] };
      const d = orderDay(o);
      c.total += Number(o.total_amount || 0);
      c.count++;
      c.orders.push({ id: o.id, d });
      if (d > c.last) c.last = d;
      per.set(o.customer_id, c);
    }
    const customers = new Map(data.customers.map((c) => [c.id, c]));
    const linesByOrder = new Map();
    for (const l of data.lines) {
      if (!linesByOrder.has(l.order_id)) linesByOrder.set(l.order_id, []);
      linesByOrder.get(l.order_id).push(l.product_name);
    }
    return [...per.entries()]
      .map(([id, c]) => ({ id, ...c, kun: daysBetween(c.last, today) }))
      .filter((c) => c.kun >= days && customers.has(c.id))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((c) => {
        const cu = customers.get(c.id);
        const last = c.orders.sort((a, b) => b.d.localeCompare(a.d))[0];
        return {
          mijoz_id: c.id,
          ism: customerName(cu),
          brend: cu.company || "",
          telefon: cu.phone || "",
          telegram: cu.telegram || "",
          oxirgi_buyurtma: c.last,
          necha_kun_oldin: c.kun,
          buyurtmalar_soni: c.count,
          jami_summa: money(c.total),
          oxirgi_mahsulotlar: [...new Set(linesByOrder.get(last.id) || [])].slice(0, 4),
        };
      });
  };

  const upcoming = (data, days = 21) => {
    const today = todayCode();
    const end = shiftDay(today, days);
    const out = [];
    for (let y = Number(today.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
      for (const [md, name] of OCCASIONS) out.push({ sana: `${y}-${md}`, nomi: name });
    }
    for (const h of data.holidays) if (h.date) out.push({ sana: String(h.date).slice(0, 10), nomi: h.name || "Bayram" });
    const seen = new Set();
    return out
      .filter((e) => e.sana >= today && e.sana <= end)
      .sort((a, b) => a.sana.localeCompare(b.sana))
      .filter((e) => !seen.has(e.sana + e.nomi) && seen.add(e.sana + e.nomi))
      .map((e) => ({ ...e, necha_kundan_keyin: daysBetween(today, e.sana) }));
  };

  const catalog = (data, query = "") =>
    data.products
      .filter((p) => p.is_active !== false && !p.archived_at)
      .filter((p) => !query || norm(`${p.name} ${p.category}`).includes(norm(query)))
      .slice(0, 60)
      .map((p) => {
        const tiers = [...(p.price_tiers || [])].sort((a, b) => a.min_qty - b.min_qty);
        return {
          nomi: p.name,
          turi: p.category || "",
          narx_dan: tiers.length ? `${money(tiers[tiers.length - 1].price)} dan (${tiers[tiers.length - 1].min_qty}+ dona)` : "",
          afzalliklar: (p.advantages || []).slice(0, 3),
          kimga: (p.recommended_for || []).slice(0, 3),
        };
      });

  // Meta Marketing API — campaign spend and results for the period.
  const metaAds = async (data, from, to) => {
    if (!ADS_TOKEN || !AD_ACCOUNT) return { ulangan: false, eslatma: "Meta reklama akkaunti ulanmagan (META_ADS_TOKEN, META_AD_ACCOUNT_ID)." };
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/act_${AD_ACCOUNT}/insights`);
    url.searchParams.set("level", "campaign");
    url.searchParams.set("fields", "campaign_name,spend,impressions,clicks,ctr,actions");
    url.searchParams.set("time_range", JSON.stringify({ since: from, until: to }));
    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", ADS_TOKEN);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const body = await res.json();
      if (body.error) return { ulangan: false, xato: body.error.message };
      const act = (row, types) => (row.actions || []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
      const crm = new Map();
      for (const l of data.leads.filter((x) => x.campaign_name && dayCodeOf(x.created_at) >= from && dayCodeOf(x.created_at) <= to)) {
        const c = crm.get(norm(l.campaign_name)) || { lid: 0, buyurtma: 0 };
        c.lid++;
        if (WON.has(l.status) || l.converted_order_id) c.buyurtma++;
        crm.set(norm(l.campaign_name), c);
      }
      const rows = (body.data || []).map((r) => {
        const spend = Number(r.spend || 0); // in the ad account's currency
        const leadsMeta = act(r, ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"]);
        const chats = act(r, ["onsite_conversion.messaging_conversation_started_7d"]);
        const c = crm.get(norm(r.campaign_name)) || { lid: 0, buyurtma: 0 };
        return {
          kampaniya: r.campaign_name,
          xarajat: `${Math.round(spend * 100) / 100}`,
          korishlar: Number(r.impressions || 0),
          bosishlar: Number(r.clicks || 0),
          ctr: r.ctr ? `${Math.round(Number(r.ctr) * 100) / 100}%` : "—",
          meta_lidlar: leadsMeta,
          yozishmalar: chats,
          lid_narxi: leadsMeta ? `${Math.round((spend / leadsMeta) * 100) / 100}` : "—",
          crm_lidlar: c.lid,
          crm_buyurtmalar: c.buyurtma,
        };
      });
      return { ulangan: true, valyuta: "reklama akkaunti valyutasida", kampaniyalar: rows.sort((a, b) => Number(b.xarajat) - Number(a.xarajat)) };
    } catch (err) {
      return { ulangan: false, xato: err.message };
    }
  };

  // ── Claude ─────────────────────────────────────────────────────────
  const callClaude = async (system, messages, tools = undefined, maxTokens = 3000) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
    return data;
  };

  const PERSONA = [
    "Sen Vodiy Print (Namangan va Farg'ona; poligrafiya, tipografiya, suvenir, gift box, textil brendlash) kompaniyasining marketologisan.",
    "Mijozlar asosan bizneslar: korporativ sovg'alar, brendlangan paket, vizitka, bloknot, krujka, kalendar, futbolka buyurtma qiladi.",
    "Raqamlarni faqat berilgan ma'lumotdan ol, o'ylab topma. Summalar tayyor formatda — o'zgartirmay ko'chir.",
    "O'zbek tilida (lotin), aniq va amaliy yoz. Telegram oddiy matn: Markdown (**, #) ishlatma, ro'yxat uchun \"•\".",
  ].join("\n");

  const writeInsights = async (payload) => {
    const system = [
      PERSONA,
      `Bugun: ${todayCode()}.`,
      "Senga haftalik marketing ma'lumoti JSON ko'rinishida beriladi. Faqat JSON qaytar, boshqa hech narsa yozma:",
      '{"tavsiyalar": ["..."], "kontent": [{"kun": "Dushanba", "format": "Post|Storis|Reels|Telegram post", "mavzu": "...", "matn": "...", "heshteglar": "#..."}], "qaytarish": [{"mijoz_id": "...", "xabar": "..."}]}',
      "tavsiyalar: 3–5 ta, har biri 1–2 gap, raqamlarga tayangan va shu hafta bajarsa bo'ladigan (qaysi manbaga ko'proq e'tibor, qaysi mahsulotni reklama qilish, javob tezligi, yo'qotish sabablari).",
      "kontent: shu hafta uchun 6 ta (dushanbadan shanbagacha). Yaqinlashayotgan bayram/mavsum va eng ko'p sotilgan yoki foydali mahsulotlarga bog'la. matn — tayyor post matni (3–6 gap, oxirida chaqiriq: Direct/Telegram/telefon), heshteglar — 4–6 ta.",
      "qaytarish: berilgan har bir mijoz uchun bitta qisqa shaxsiy xabar (2–3 gap): ismi bilan murojaat, oldingi buyurtmasini eslat, yaqin bayram yoki yangi mahsulot bilan bog'liq taklif. Chegirma va'da qilma.",
    ].join("\n");
    const reply = await callClaude(system, [{ role: "user", content: JSON.stringify(payload) }], undefined, 6000);
    const text = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return JSON.parse(json);
  };

  // ── weekly report ──────────────────────────────────────────────────
  const post = async (text) => {
    if (!route) return;
    const target = await route("mkt");
    for (const part of chunks(text)) await telegram("sendMessage", { ...target, text: part, link_preview_options: { is_disabled: true } });
  };

  const buildReport = async () => {
    const data = await load();
    const today = todayCode();
    const to = shiftDay(today, -1);
    const from = shiftDay(to, -6);
    const prev = stats(data, shiftDay(from, -7), shiftDay(from, -1));
    const week = stats(data, from, to);
    const month = stats(data, `${today.slice(0, 8)}01`, today);
    const ads = await metaAds(data, from, to);
    const lost = dormant(data);
    const events = upcoming(data);

    const L = [];
    L.push(`📣 Haftalik marketing hisoboti · ${human(from)} – ${human(to)}`);
    L.push("");
    L.push(`Lidlar: ${week.lidlar}${trend(week.lidlar, prev.lidlar)} · buyurtmaga aylangan: ${week.lid_buyurtmaga} (${week.lid_konversiya})`);
    L.push(`Buyurtmalar: ${week.buyurtmalar}${trend(week.buyurtmalar, prev.buyurtmalar)} · tushum: ${week.tushum}${trend(week.tushum_raqam, prev.tushum_raqam)}`);
    L.push(`O'rtacha chek: ${week.ortacha_chek} · mijozlar: ${week.mijozlar} (yangi ${week.yangi_mijozlar}, qaytgan ${week.qaytgan_mijozlar})`);
    if (week.birinchi_javob_mediana) L.push(`Lidga birinchi javob (mediana): ${week.birinchi_javob_mediana}`);
    L.push(`Reklama xarajati (Moliya → «Reklama»): ${week.reklama_xarajati}${week.bir_lid_narxi ? ` · 1 lid: ${week.bir_lid_narxi}` : ""}${week.bir_mijoz_narxi ? ` · 1 yangi mijoz: ${week.bir_mijoz_narxi}` : ""}`);
    if (week.manbalar.length) {
      L.push("", "Lid manbalari:");
      for (const s of week.manbalar) L.push(`• ${s.manba}: ${s.lidlar} lid → ${s.buyurtma} buyurtma (${s.konversiya})${s.yoqotilgan ? `, ${s.yoqotilgan} yo'qotilgan` : ""}`);
    }
    if (Object.keys(week.yoqotish_sabablari).length) {
      L.push("", "Yo'qotish sabablari: " + Object.entries(week.yoqotish_sabablari).map(([k, v]) => `${k} (${v})`).join(", "));
    }
    if (week.tushum_manba_boyicha.length) {
      L.push("", "Tushum manba bo'yicha:");
      for (const s of week.tushum_manba_boyicha.slice(0, 6)) L.push(`• ${s.manba}: ${s.buyurtmalar} ta, ${s.summa}`);
    }
    if (week.top_mahsulotlar.length) {
      L.push("", "Eng ko'p sotilgan mahsulotlar:");
      for (const p of week.top_mahsulotlar.slice(0, 6)) L.push(`• ${p.nomi}: ${p.soni} dona, ${p.summa} · foyda: ${p.foyda}`);
    }
    L.push("", `Oy boshidan: ${month.lidlar} lid, ${month.buyurtmalar} buyurtma, ${month.tushum}.`);
    const messages = [L.join("\n")];

    if (ads.ulangan) {
      const A = [`📊 Meta reklama · ${human(from)} – ${human(to)}`];
      if (!ads.kampaniyalar.length) A.push("Bu hafta faol kampaniya bo'lmagan.");
      for (const c of ads.kampaniyalar.slice(0, 8)) {
        A.push(`• ${c.kampaniya}: xarajat ${c.xarajat}, ko'rishlar ${c.korishlar}, CTR ${c.ctr}, lid ${c.meta_lidlar}${c.yozishmalar ? `, yozishma ${c.yozishmalar}` : ""}, 1 lid ${c.lid_narxi} → CRM'da ${c.crm_lidlar} lid, ${c.crm_buyurtmalar} buyurtma`);
      }
      messages.push(A.join("\n"));
    } else {
      messages.push(`📊 Meta reklama: ${ads.xato ? `ma'lumot olinmadi — ${ads.xato}` : "ulanmagan. Ulansa, har bir kampaniya bo'yicha xarajat va lid narxi shu yerda chiqadi."}`);
    }

    let ai = null;
    if (ANTHROPIC_API_KEY) {
      try {
        ai = await writeInsights({
          hafta: week,
          otgan_hafta: { lidlar: prev.lidlar, buyurtmalar: prev.buyurtmalar, tushum: prev.tushum },
          oy_boshidan: { lidlar: month.lidlar, buyurtmalar: month.buyurtmalar, tushum: month.tushum },
          meta: ads,
          yaqin_bayramlar: events,
          katalog: catalog(data).slice(0, 40),
          qaytariladigan_mijozlar: lost,
        });
      } catch (err) {
        console.error("Marketing insights failed", err.message);
      }
    }
    if (ai) {
      const T = ["💡 Tavsiyalar", ...(ai.tavsiyalar || []).map((t) => `• ${t}`)];
      if (events.length) T.push("", "Yaqin sanalar: " + events.slice(0, 5).map((e) => `${human(e.sana)} — ${e.nomi}`).join("; "));
      messages.push(T.join("\n"));
      const K = [`🗓 Kontent-reja · ${human(today)} haftasi`];
      for (const k of ai.kontent || []) {
        K.push("", `${k.kun} · ${k.format} — ${k.mavzu}`, k.matn, k.heshteglar || "");
      }
      messages.push(K.join("\n").trim());
    }
    if (lost.length) {
      const byId = new Map(((ai && ai.qaytarish) || []).map((q) => [q.mijoz_id, q.xabar]));
      const Q = [`🔁 Qaytarish kerak: ${DORMANT_DAYS}+ kundan beri buyurtma bermagan mijozlar (eng katta xaridorlar)`];
      for (const c of lost) {
        Q.push("", `• ${c.ism}${c.brend ? ` (${c.brend})` : ""} — ${c.telefon || c.telegram || "kontakt yo'q"}`);
        Q.push(`  Oxirgi: ${human(c.oxirgi_buyurtma)} (${c.necha_kun_oldin} kun oldin), jami ${c.buyurtmalar_soni} ta, ${c.jami_summa}${c.oxirgi_mahsulotlar.length ? ` · ${c.oxirgi_mahsulotlar.join(", ")}` : ""}`);
        if (byId.get(c.mijoz_id)) Q.push(`  ✉️ ${byId.get(c.mijoz_id)}`);
      }
      messages.push(Q.join("\n"));
    }
    return { messages, week, prev, month, ads, dormant: lost, events, ai, from, to };
  };

  const runWeekly = async (reason = "schedule") => {
    const r = await buildReport();
    for (const m of r.messages) await post(m);
    await db.collection("marketing_reports").doc(todayCode()).set({
      created_at: new Date().toISOString(),
      reason,
      from: r.from,
      to: r.to,
      week: r.week,
      dormant: r.dormant,
      ai: r.ai,
      messages: r.messages,
    });
    await emitEvent(db, {
      agent: "mkt",
      kind: "report",
      text: `Haftalik marketing: ${r.week.lidlar} lid, ${r.week.buyurtmalar} buyurtma, ${r.week.tushum}`,
      bubble: `Haftalik hisobot: ${r.week.lidlar} lid 📈`,
      visit: r.dormant.length ? "sales" : null,
      source: reason,
    });
    await db.collection("agent_status").doc("mkt").set({ alert: false, summary: clip(r.messages[0], 220), updated_at: new Date().toISOString() });
    console.log(`Marketing report sent (${reason}): ${r.week.lidlar} leads, ${r.messages.length} messages`);
    return r;
  };

  // Monday 09:00 Tashkent, once per week even across restarts.
  let timer = null;
  const tick = async () => {
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    if (now.getUTCDay() !== 1 || now.getUTCHours() < REPORT_HOUR || now.getUTCHours() >= REPORT_HOUR + 4) return;
    const run = db.collection("marketing_runs").doc(todayCode());
    try {
      await run.create({ started_at: new Date().toISOString() });
    } catch {
      return;
    }
    try {
      await runWeekly("schedule");
      await run.update({ done_at: new Date().toISOString() });
    } catch (err) {
      console.error("Weekly marketing report failed", err);
      await run.update({ error: err.message });
      await post(`📣 Haftalik marketing hisobotini tayyorlab bo'lmadi: ${err.message}`).catch(() => undefined);
    }
  };

  // ── questions in the Marketing topic ───────────────────────────────
  const period = (from, to) => {
    const today = todayCode();
    const f = /^\d{4}-\d{2}-\d{2}$/.test(from || "") ? from : shiftDay(today, -6);
    const t = /^\d{4}-\d{2}-\d{2}$/.test(to || "") ? to : today;
    return [f, t];
  };
  const DATE_PROPS = {
    from: { type: "string", description: "Boshlanish sanasi YYYY-MM-DD" },
    to: { type: "string", description: "Tugash sanasi YYYY-MM-DD" },
  };
  const TOOLS = [
    { name: "marketing_overview", description: "Davr bo'yicha lidlar (manba, konversiya, yo'qotish sabablari, javob tezligi), buyurtmalar, tushum manba bo'yicha, yangi/qaytgan mijozlar, top mahsulotlar va foyda, reklama xarajati, 1 lid va 1 mijoz narxi.", input_schema: { type: "object", properties: DATE_PROPS, required: ["from", "to"] } },
    { name: "dormant_customers", description: "Uzoq vaqt buyurtma bermagan mijozlar (eng katta xaridorlar birinchi): oxirgi buyurtma, jami summa, oxirgi mahsulotlar, kontakt.", input_schema: { type: "object", properties: { kun: { type: "number", description: "Necha kundan beri (standart 60)" }, limit: { type: "number" } } } },
    { name: "meta_ads", description: "Meta (Facebook/Instagram) reklama kampaniyalari: xarajat, ko'rishlar, CTR, lidlar, lid narxi va CRM'dagi natija.", input_schema: { type: "object", properties: DATE_PROPS, required: ["from", "to"] } },
    { name: "catalog", description: "Kompaniya mahsulotlari: nomi, turi, boshlang'ich narx, afzalliklar — post va takliflar uchun.", input_schema: { type: "object", properties: { query: { type: "string" } } } },
    { name: "upcoming_dates", description: "Yaqin bayram va mavsumiy sanalar (kontent-reja uchun).", input_schema: { type: "object", properties: { kun: { type: "number" } } } },
  ];

  const answer = async (question, context) => {
    const data = await load();
    const impl = {
      marketing_overview: ({ from, to }) => {
        const s = stats(data, ...period(from, to));
        delete s.tushum_raqam;
        delete s.reklama_raqam;
        return s;
      },
      dormant_customers: ({ kun, limit }) => dormant(data, Number(kun) || DORMANT_DAYS, Math.min(30, Number(limit) || 10)),
      meta_ads: ({ from, to }) => metaAds(data, ...period(from, to)),
      catalog: ({ query }) => catalog(data, query),
      upcoming_dates: ({ kun }) => upcoming(data, Math.min(120, Number(kun) || 30)),
    };
    const system = [
      PERSONA,
      `Bugun: ${todayCode()} (${WEEKDAYS[new Date(`${todayCode()}T00:00:00Z`).getUTCDay()]}).`,
      "Rahbar yoki sotuv jamoasi Telegram'dagi «Marketing» mavzusida savol beradi yoki topshiriq beradi (tahlil, post matni, reklama g'oyasi, mijozlarga xabar, kontent-reja).",
      "Ma'lumot kerak bo'lsa vositalarni chaqir. Davr aytilmasa: \"bu hafta\" — oxirgi 7 kun, \"bu oy\" — oy boshidan; qaysi davrni olganingni ayt.",
      "Post yoki xabar so'ralsa — tayyor, ko'chirib ishlatsa bo'ladigan matn yoz. Tahlilda: avval asosiy xulosa, keyin 3–8 qator tafsilot va aniq tavsiya.",
    ].join("\n");
    const content = context ? `Oldingi xabar (kontekst):\n${context}\n\nSavol:\n${question}` : question;
    const messages = [{ role: "user", content }];
    for (let step = 0; step < 6; step++) {
      const reply = await callClaude(system, messages, TOOLS, 2500);
      if (reply.stop_reason !== "tool_use") return reply.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      messages.push({ role: "assistant", content: reply.content });
      const results = [];
      for (const b of reply.content.filter((x) => x.type === "tool_use")) {
        let out;
        try {
          out = await impl[b.name](b.input || {});
        } catch (err) {
          out = { xato: err.message };
        }
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) });
      }
      messages.push({ role: "user", content: results });
    }
    return "Savol juda murakkab bo'lib ketdi — aniqroq so'rang.";
  };

  // Called by assistant.js for messages in the Marketing topic.
  const handleMessage = async (msg, text) => {
    const thread = msg.is_topic_message ? { message_thread_id: msg.message_thread_id } : {};
    const reply = (t) =>
      telegram("sendMessage", {
        chat_id: msg.chat.id,
        ...thread,
        text: t,
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
        link_preview_options: { is_disabled: true },
      });
    if (/^\/hisobot\b/i.test(text)) {
      await reply("⏳ Haftalik hisobot tayyorlanmoqda…");
      await runWeekly("command");
      return;
    }
    await emitEvent(db, { agent: "mkt", kind: "question", text: clip(text, 160), bubble: clip(text, 90), source: "telegram" });
    await telegram("sendChatAction", { chat_id: msg.chat.id, action: "typing", ...thread });
    const out = (await answer(text, msg.reply_to_message?.text || "")) || "Javob topilmadi.";
    for (const part of chunks(out)) await reply(part);
    await emitEvent(db, { agent: "mkt", kind: "report", text: clip(out, 220), bubble: clip(out, 90), source: "telegram" });
    console.log(`Marketolog answered: ${text.slice(0, 80)}`);
  };

  const register = (app) => {
    // Sozlamalar / testing: send the weekly report now.
    app.post("/webhooks/marketing/run", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin") return res.status(403).json({ error: "Faqat admin" });
      try {
        const r = await runWeekly("web");
        res.json({ ok: true, messages: r.messages.length });
      } catch (err) {
        console.error("Marketing run failed", err);
        res.status(500).json({ error: err.message });
      }
    });
  };

  const start = async () => {
    await tick();
    timer = setInterval(() => tick().catch((err) => console.error("Marketing tick failed", err)), 5 * 60 * 1000);
    console.log(`Marketolog agent started (weekly Monday ${REPORT_HOUR}:00, Meta ads ${ADS_TOKEN && AD_ACCOUNT ? "on" : "off"})`);
  };
  const stop = () => clearInterval(timer);

  return { register, start, stop, handleMessage, runWeekly, buildReport, tick, _test: { stats, dormant, upcoming, catalog, load } };
};

module.exports = { create, chunks, OCCASIONS };
