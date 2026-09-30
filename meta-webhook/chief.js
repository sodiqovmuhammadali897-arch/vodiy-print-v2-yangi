// Bosh agent — the chief-of-staff agent. Every morning (08:30 Tashkent,
// Monday–Saturday) it looks at the whole company against the month's plan
// and the four goals the owner set (more sales, more profit, returning
// customers, cash and debts), and posts to the "🧠 Bosh agent" topic:
//
//   • where we stand (plan progress, cash, debts — computed in code);
//   • the three biggest problems and opportunities it sees;
//   • up to three concrete proposals, each with its plan, ready posts,
//     a customer message and list, staff tasks and a way to measure it,
//     under ✅ / ❌ buttons.
//
// Nothing happens without ✅ (from a chat admin). On ✅ it creates the ERP
// tasks, hands the posts to the Marketing topic and the customer list to
// the Sales topic, and records a baseline; when the measuring window ends
// it reports what changed. Proposals and their results are its memory:
// rejected ideas aren't repeated, and what worked is reused.
//
// Replying to a proposal message revises it; any other message in the
// topic is a question to the agent. /brif sends the brief right away.
const Anthropic = require("@anthropic-ai/sdk").default;
const { telegram } = require("./telegram");
const { staffFromRequest } = require("./auth");
const { isChatAdmin } = require("./actions");
const { emitEvent, clip, money, todayCode, dayCodeOf, customerName, norm, orderDebt, VENDOR_EXPENSE_CATEGORY } = require("./shared");

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.CHIEF_MODEL || "claude-opus-5";
// Used if the account can't use MODEL (e.g. no access to it yet).
const BACKUP_MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5";
const BRIEF_AT_MIN = 8 * 60 + 30; // 08:30
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DONE_STATUSES = new Set(["ready", "ready_to_deliver", "delivered", "closed", "cancelled"]);
const GOAL_LABEL = { savdo: "📈 Savdo", foyda: "💰 Foyda", mijozlar: "🔁 Mijozlar", pul: "🏦 Pul oqimi" };
const ROLE_MODULE = { sotuv: "leads", moliya: "finance", ishlab_chiqarish: "production", ombor: "warehouse", marketing: "leads" };
const ROLE_LABEL = { sotuv: "Sotuv", moliya: "Moliya", ishlab_chiqarish: "Ishlab chiqarish", ombor: "Ombor", marketing: "Marketing", rahbar: "Rahbar" };
const METRIC_LABEL = {
  tushum: "umumiy tushum",
  mahsulot_tushumi: "mahsulot tushumi",
  lidlar: "lidlar soni",
  qaytgan_mijozlar: "qaytib buyurtma bergan mijozlar",
  qarz_yigildi: "yig'ilgan qarz",
};

const shiftDay = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const chunks = (text, size = 3900) => {
  const out = [];
  let cur = "";
  for (const line of String(text).split("\n")) {
    if ((cur + "\n" + line).length > size && cur) {
      out.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
};

// ── structured output schemas ────────────────────────────────────────
const obj = (props) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const str = { type: "string" };
const PROPOSAL = obj({
  sarlavha: str,
  maqsad: { type: "string", enum: ["savdo", "foyda", "mijozlar", "pul"] },
  agent: { type: "string", enum: ["sales", "fin", "mkt", "prod", "wh"] },
  nega: str,
  reja: { type: "array", items: str },
  kutilgan_natija: str,
  postlar: { type: "array", items: obj({ format: str, matn: str, heshteglar: str, rasm_goyasi: str }) },
  mijozlarga_xabar: str,
  segment: { type: "string", enum: ["yoq", "uxlab_qolgan", "qarzdorlar", "mahsulot_xaridorlari"] },
  segment_parametr: str,
  vazifalar: {
    type: "array",
    items: obj({ kimga: { type: "string", enum: ["sotuv", "moliya", "ishlab_chiqarish", "ombor", "marketing", "rahbar"] }, vazifa: str, muddat_kun: { type: "integer" } }),
  },
  olchov: obj({ turi: { type: "string", enum: Object.keys(METRIC_LABEL) }, parametr: str, kun: { type: "integer" } }),
});
const BRIEF = obj({
  holat: str,
  muammolar: { type: "array", items: obj({ sarlavha: str, tafsilot: str }) },
  imkoniyatlar: { type: "array", items: obj({ sarlavha: str, tafsilot: str }) },
  takliflar: { type: "array", items: PROPOSAL },
});

const create = (db, { route = null, analytics } = {}) => {
  const client = API_KEY ? new Anthropic({ apiKey: API_KEY, timeout: 15 * 60 * 1000, maxRetries: 2 }) : null;
  const read = async (col) => (await db.collection(col).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  // ── the model ──────────────────────────────────────────────────────
  // Claude Opus with adaptive thinking; streamed because a full brief can
  // take minutes. Server-side fallback re-runs a policy-declined request
  // on Anthropic's recommended fallback model instead of failing.
  let fallbacksOk = true;
  let model = MODEL;
  const think = async (system, content, schema = null, maxTokens = 16000) => {
    if (!client) throw new Error("ANTHROPIC_API_KEY yo'q");
    const params = {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: "high", ...(schema ? { format: { type: "json_schema", schema } } : {}) },
    };
    let msg;
    try {
      msg = fallbacksOk
        ? await client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }).finalMessage()
        : await client.messages.stream(params).finalMessage();
    } catch (err) {
      if (fallbacksOk && err instanceof Anthropic.BadRequestError && /fallback/i.test(err.message)) {
        fallbacksOk = false;
        return think(system, content, schema, maxTokens);
      }
      if (model !== BACKUP_MODEL && err instanceof Anthropic.NotFoundError) {
        console.error(`Bosh agent: ${model} unavailable, using ${BACKUP_MODEL}`);
        model = BACKUP_MODEL;
        return think(system, content, schema, maxTokens);
      }
      throw err;
    }
    if (msg.stop_reason === "refusal") throw new Error("Model bu so'rovga javob bermadi (refusal)");
    if (msg.stop_reason === "max_tokens") throw new Error("Javob juda uzun bo'lib ketdi (max_tokens)");
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return schema ? JSON.parse(text) : text.trim();
  };

  // ── the company snapshot (all numbers computed here) ───────────────
  const loadAll = async () => {
    const data = await analytics.load();
    const [payments, supplierInvoices, stock, plans, staff, research, proposals, orderCosts] = await Promise.all([
      read("order_payments"),
      read("supplier_invoices").catch(() => []),
      read("warehouse_items").catch(() => []),
      read("monthly_plans").catch(() => []),
      read("staff").catch(() => []),
      read("competitor_research").catch(() => []),
      read("chief_proposals").catch(() => []),
      read("order_costs").catch(() => []),
    ]);
    return { ...data, payments, supplierInvoices, stock, plans, staff, research, proposals, orderCosts };
  };

  const orderDay = (o) => dayCodeOf(o.order_date || o.created_at);

  const unitCostFn = (data) => {
    const byId = new Map(data.costs.map((c) => [c.id, [...(c.cost_tiers || [])].sort((a, b) => a.min_qty - b.min_qty)]));
    const byName = new Map();
    for (const p of data.products) if (byId.get(p.id)?.length) byName.set(norm(p.name), byId.get(p.id));
    return (name, qty) => {
      const tiers = byName.get(norm(name));
      if (!tiers) return null;
      let c = tiers[0].cost_price;
      for (const t of tiers) if (qty >= t.min_qty) c = t.cost_price;
      return Number(c) || null;
    };
  };

  const marginOf = (data, from, to) => {
    const ids = new Set(data.orders.filter((o) => orderDay(o) >= from && orderDay(o) <= to).map((o) => o.id));
    const cost = unitCostFn(data);
    // Costs typed on the Marja page win (keyed by order + the line's place,
    // older ones by line id — see src/lib/margin.ts); the catalog fills the rest.
    const typedDocs = new Map((data.orderCosts || []).map((c) => [c.id, c]));
    const byOrder = new Map();
    for (const l of data.lines) if (ids.has(l.order_id)) byOrder.set(l.order_id, [...(byOrder.get(l.order_id) || []), l]);
    const typed = new Map();
    for (const [orderId, ls] of byOrder) {
      ls.sort((a, b) => (a.position || 0) - (b.position || 0)).forEach((l, i) => {
        const c = typedDocs.get(`${orderId}_L${i}`);
        const ok = c && (!c.product_name || norm(c.product_name) === norm(l.product_name));
        const hit = ok ? c : typedDocs.get(l.id);
        if (hit) typed.set(l.id, Number(hit.total_cost) || 0);
      });
    }
    let known = 0;
    let knownCost = 0;
    let all = 0;
    for (const l of data.lines) {
      if (!ids.has(l.order_id)) continue;
      const total = Number(l.total || 0);
      all += total;
      if (typed.has(l.id)) {
        known += total;
        knownCost += typed.get(l.id);
        continue;
      }
      const c = cost(l.product_name, Number(l.quantity || 0));
      if (c !== null) {
        known += total;
        knownCost += c * Number(l.quantity || 0);
      }
    }
    return { marja: known ? `${pct(known - knownCost, known)}%` : "tannarx kiritilmagan", tannarx_qamrovi: `${pct(known, all)}% tushum bo'yicha` };
  };

  const snapshot = (data) => {
    const today = todayCode();
    const [y, m, d] = today.split("-").map(Number);
    const monthStart = today.slice(0, 8) + "01";
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lmStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const lmDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const lmSame = shiftDay(lmStart, Math.min(d, lmDays) - 1);
    const mtd = analytics.stats(data, monthStart, today);
    const lastMtd = analytics.stats(data, lmStart, lmSame);
    const plan = Number((data.plans.find((p) => Number(p.year) === y && Number(p.month) === m) || {}).plan_amount || 0);
    const projected = Math.round((mtd.tushum_raqam / d) * daysInMonth);
    const perDayNeeded = plan ? Math.max(0, Math.round((plan - mtd.tushum_raqam) / (daysInMonth - d + 1))) : 0;

    // Receivables and their age
    const debts = data.orders
      .map((o) => ({ o, debt: orderDebt(o) }))
      .filter((x) => x.debt > 0)
      .map((x) => ({ ...x, age: daysBetween(orderDay(x.o), today) }));
    const customers = new Map(data.customers.map((c) => [c.id, c]));
    const bucket = (lo, hi) => debts.filter((x) => x.age >= lo && x.age <= hi).reduce((s, x) => s + x.debt, 0);
    const byDebtor = new Map();
    for (const x of debts) {
      const k = x.o.customer_id || "—";
      const c = byDebtor.get(k) || { mijoz: customers.get(k) ? customerName(customers.get(k)) : "Noma'lum", summa: 0, eng_eski_kun: 0 };
      c.summa += x.debt;
      c.eng_eski_kun = Math.max(c.eng_eski_kun, x.age);
      byDebtor.set(k, c);
    }

    // Payables to suppliers
    const owed = new Map();
    for (const i of data.supplierInvoices) owed.set(i.vendor_name || i.vendor_id, (owed.get(i.vendor_name || i.vendor_id) || 0) + Number(i.amount || 0));
    for (const e of data.expenses.filter((x) => x.category === VENDOR_EXPENSE_CATEGORY)) owed.set(e.vendor_name || e.vendor_id, (owed.get(e.vendor_name || e.vendor_id) || 0) - Number(e.amount || 0));
    const payables = [...owed.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    // Cash in / out
    const inWin = (dd, from, to) => dd && dd >= from && dd <= to;
    const in30 = data.payments.filter((p) => inWin(dayCodeOf(p.payment_date || p.created_at), shiftDay(today, -29), today)).reduce((s, p) => s + Number(p.amount || 0), 0);
    const out30 = data.expenses.filter((e) => inWin(dayCodeOf(e.date || e.created_at), shiftDay(today, -29), today)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const expByCat = (from, to) => {
      const mm = new Map();
      for (const e of data.expenses.filter((x) => inWin(dayCodeOf(x.date || x.created_at), from, to))) mm.set(e.category || "Boshqa", (mm.get(e.category || "Boshqa") || 0) + Number(e.amount || 0));
      return mm;
    };
    const expNow = expByCat(monthStart, today);
    const expThen = expByCat(lmStart, lmSame);

    const overdue = data.orders.filter((o) => !o.is_historical && o.deadline && dayCodeOf(o.deadline) < today && !DONE_STATUSES.has(o.status));
    const lowStock = data.stock.filter((i) => Number(i.quantity || 0) <= Number(i.min_threshold || 0));
    const unanswered = data.leads.filter((l) => l.status === "new" && !l.first_contact_at && Date.now() - Date.parse(l.created_at) > 2 * 3600 * 1000);

    return {
      bugun: today,
      reja: {
        oylik_reja: plan ? money(plan) : "kiritilmagan (Sozlamalar → Oylik reja)",
        oy_boshidan_tushum: mtd.tushum,
        bajarildi: plan ? `${pct(mtd.tushum_raqam, plan)}%` : null,
        shu_surat_bilan_oy_oxiri: money(projected),
        farq_rejadan: plan ? money(projected - plan) : null,
        qolgan_kunlarda_kuniga_kerak: plan ? money(perDayNeeded) : null,
        otgan_oy_shu_davrda: lastMtd.tushum,
      },
      savdo_oy_boshidan: mtd,
      savdo_otgan_oy_shu_davr: { lidlar: lastMtd.lidlar, buyurtmalar: lastMtd.buyurtmalar, tushum: lastMtd.tushum, ortacha_chek: lastMtd.ortacha_chek, lid_konversiya: lastMtd.lid_konversiya },
      oxirgi_30_kun: analytics.stats(data, shiftDay(today, -29), today),
      marja: { oy_boshidan: marginOf(data, monthStart, today), otgan_oy_shu_davr: marginOf(data, lmStart, lmSame) },
      debitorlik: {
        jami: money(debts.reduce((s, x) => s + x.debt, 0)),
        buyurtmalar_soni: debts.length,
        yoshi: { "0-30 kun": money(bucket(0, 30)), "31-60 kun": money(bucket(31, 60)), "60+ kun": money(bucket(61, 100000)) },
        eng_katta_qarzdorlar: [...byDebtor.values()].sort((a, b) => b.summa - a.summa).slice(0, 8).map((c) => ({ ...c, summa: money(c.summa) })),
      },
      taminotchilarga_qarz: { jami: money(payables.reduce((s, [, v]) => s + v, 0)), kimga: payables.slice(0, 6).map(([k, v]) => `${k}: ${money(v)}`) },
      pul_oqimi_30_kun: { kirim: money(in30), chiqim: money(out30), sof: money(in30 - out30) },
      xarajatlar_oy_boshidan: [...expNow.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ turi: k, summa: money(v), otgan_oy_shu_davr: money(expThen.get(k) || 0) })),
      kechikayotgan_buyurtmalar: { soni: overdue.length, misollar: overdue.slice(0, 5).map((o) => `${o.order_number || o.id} (${o.title || ""}, muddat ${dayCodeOf(o.deadline)})`) },
      kam_qolgan_materiallar: lowStock.slice(0, 8).map((i) => `${i.name}: ${i.quantity} ${i.unit || ""} (min ${i.min_threshold})`),
      javobsiz_lidlar: { soni: unanswered.length, eng_eskisi: unanswered.length ? `${Math.round((Date.now() - Math.min(...unanswered.map((l) => Date.parse(l.created_at)))) / 3600000)} soat` : null },
      uxlab_qolgan_katta_mijozlar: analytics.dormant(data, 60, 12),
      raqobatchilar: data.research.map((r) => ({ nomi: r.name, sana: r.researched_at, ...(r.summary || {}) })).slice(0, 8),
      yaqin_sanalar: analytics.upcoming(data, 30),
      katalog: analytics.catalog(data).slice(0, 30),
      _raw: { mtdRevenue: mtd.tushum_raqam, plan, projected, in30, out30 },
    };
  };

  const memoryOf = (data) =>
    data.proposals
      .filter((p) => p.created_date >= shiftDay(todayCode(), -90))
      .sort((a, b) => b.created_date.localeCompare(a.created_date))
      .slice(0, 30)
      .map((p) => ({ sana: p.created_date, sarlavha: p.sarlavha, maqsad: p.maqsad, holat: p.status, natija: p.outcome_text || null, rad_sababi: p.feedback || null }));

  // ── customer segments for a proposal ───────────────────────────────
  const resolveSegment = (data, segment, param) => {
    const customers = new Map(data.customers.map((c) => [c.id, c]));
    const pack = (ids) =>
      ids
        .map((id) => customers.get(id))
        .filter(Boolean)
        .map((c) => ({ id: c.id, ism: customerName(c), telefon: c.phone || "", telegram: c.telegram || "", brend: c.company || "" }));
    if (segment === "uxlab_qolgan") return pack(analytics.dormant(data, Number(param) || 60, 60).map((x) => x.mijoz_id));
    if (segment === "qarzdorlar") {
      const debt = new Map();
      for (const o of data.orders) if (o.customer_id && orderDebt(o) > 0) debt.set(o.customer_id, (debt.get(o.customer_id) || 0) + orderDebt(o));
      return pack([...debt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id]) => id));
    }
    if (segment === "mahsulot_xaridorlari" && param) {
      const want = norm(param);
      const orderIds = new Set(data.lines.filter((l) => norm(l.product_name).includes(want)).map((l) => l.order_id));
      const spend = new Map();
      for (const o of data.orders) if (orderIds.has(o.id) && o.customer_id) spend.set(o.customer_id, (spend.get(o.customer_id) || 0) + Number(o.total_amount || 0));
      return pack([...spend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id]) => id));
    }
    return [];
  };

  // ── measuring a proposal ───────────────────────────────────────────
  const measure = (data, p, from, to) => {
    const inWin = (dd) => dd && dd >= from && dd <= to;
    const orders = data.orders.filter((o) => inWin(orderDay(o)));
    const t = p.olchov?.turi;
    if (t === "tushum") return orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    if (t === "mahsulot_tushumi") {
      const ids = new Set(orders.map((o) => o.id));
      const want = norm(p.olchov.parametr || "");
      return data.lines.filter((l) => ids.has(l.order_id) && (!want || norm(l.product_name).includes(want))).reduce((s, l) => s + Number(l.total || 0), 0);
    }
    if (t === "lidlar") {
      const want = norm(p.olchov.parametr || "");
      return data.leads.filter((l) => inWin(dayCodeOf(l.created_at)) && (!want || norm(l.source).includes(want))).length;
    }
    const seg = new Set((p.segment_customers || []).map((c) => c.id));
    if (t === "qaytgan_mijozlar") return new Set(orders.filter((o) => seg.has(o.customer_id)).map((o) => o.customer_id)).size;
    if (t === "qarz_yigildi") {
      const segOrders = new Set(data.orders.filter((o) => !seg.size || seg.has(o.customer_id)).map((o) => o.id));
      return data.payments.filter((x) => segOrders.has(x.order_id) && inWin(dayCodeOf(x.payment_date || x.created_at))).reduce((s, x) => s + Number(x.amount || 0), 0);
    }
    return 0;
  };
  const fmtMetric = (p, v) => (["tushum", "mahsulot_tushumi", "qarz_yigildi"].includes(p.olchov?.turi) ? money(v) : `${v} ta`);

  // ── Telegram ───────────────────────────────────────────────────────
  const target = async (agent = "chief") => (route ? route(agent) : null);
  const post = async (text, agent = "chief", extra = {}) => {
    const t = await target(agent);
    if (!t) return null;
    let last = null;
    const parts = chunks(text);
    for (let i = 0; i < parts.length; i++) {
      last = await telegram("sendMessage", { ...t, text: parts[i], link_preview_options: { is_disabled: true }, ...(i === parts.length - 1 ? extra : {}) });
    }
    return last?.result || null;
  };

  const proposalText = (p, i, n) => {
    const L = [`💡 Taklif ${i}/${n} · ${GOAL_LABEL[p.maqsad] || p.maqsad}`, `«${p.sarlavha}»`, "", `Nega: ${p.nega}`, "", "Reja:"];
    (p.reja || []).forEach((r, k) => L.push(`${k + 1}. ${r}`));
    L.push("", `Kutilgan natija: ${p.kutilgan_natija}`);
    const ready = [];
    if (p.postlar?.length) ready.push(`${p.postlar.length} ta post`);
    if (p.mijozlarga_xabar && p.segment_customers?.length) ready.push(`${p.segment_customers.length} ta mijozga xabar`);
    if (p.vazifalar?.length) ready.push(`${p.vazifalar.length} ta vazifa (${p.vazifalar.map((v) => ROLE_LABEL[v.kimga] || v.kimga).join(", ")})`);
    if (ready.length) L.push(`Tayyor: ${ready.join(", ")}`);
    if (p.olchov) L.push(`O'lchov: ${METRIC_LABEL[p.olchov.turi] || p.olchov.turi}${p.olchov.parametr ? ` (${p.olchov.parametr})` : ""}, ${p.olchov.kun} kun`);
    L.push("", "O'zgartirish uchun shu xabarga javob yozing.");
    return L.join("\n");
  };
  const buttons = (id) => ({ reply_markup: { inline_keyboard: [[{ text: "✅ Boshlash", callback_data: `chief:ok:${id}` }, { text: "❌ Kerak emas", callback_data: `chief:no:${id}` }]] } });

  const saveAndPostProposal = async (data, p, i, n, extra = {}) => {
    const segment_customers = p.segment && p.segment !== "yoq" ? resolveSegment(data, p.segment, p.segment_parametr) : [];
    const ref = db.collection("chief_proposals").doc();
    const doc = { ...p, ...extra, segment_customers, status: "pending", created_date: todayCode(), created_at: new Date().toISOString() };
    const sent = await post(proposalText(doc, i, n), "chief", buttons(ref.id));
    await ref.set({ ...doc, tg_chat_id: sent?.chat?.id || null, tg_message_id: sent?.message_id || null });
    return { id: ref.id, ...doc };
  };

  // ── reviews: proposals whose measuring window has ended ────────────
  const reviewDue = async (data) => {
    const today = todayCode();
    const lines = [];
    for (const p of data.proposals.filter((x) => x.status === "approved" && x.review_date && x.review_date <= today)) {
      const days = Number(p.olchov?.kun) || 14;
      const after = measure(data, p, p.approved_date, shiftDay(p.approved_date, days - 1));
      const before = Number(p.baseline || 0);
      const delta = before ? `${after >= before ? "+" : ""}${pct(after - before, before)}%` : "oldin 0";
      const text = `${METRIC_LABEL[p.olchov?.turi] || "natija"}: ${fmtMetric(p, after)} (oldingi ${days} kunda ${fmtMetric(p, before)}, ${delta})`;
      await db.collection("chief_proposals").doc(p.id).update({ status: "measured", outcome: after, outcome_text: text, measured_at: new Date().toISOString() });
      p.status = "measured";
      p.outcome_text = text;
      lines.push(`• «${p.sarlavha}» — ${text}`);
    }
    return lines;
  };

  // ── the daily brief ────────────────────────────────────────────────
  const SYSTEM = [
    "Sen Vodiy Print (Namangan va Farg'ona; poligrafiya, tipografiya, suvenir, gift box, textil brendlash; mijozlar asosan bizneslar) kompaniyasining Bosh agentisan — direktorning o'ng qo'li.",
    "Maqsadlar (hammasi muhim): 1) ko'proq savdo va oylik rejani bajarish; 2) ko'proq foyda (marja); 3) eski mijozlarni qaytarish; 4) pul oqimi va qarzlarni yig'ish.",
    "Senga kompaniyaning bugungi holati (raqamlar kodda hisoblangan) va o'tgan takliflaring bilan natijalari (xotira) JSON'da beriladi.",
    "Vazifang: eng muhim 3 ta muammo va 3 ta imkoniyatni top, va eng ko'p pul olib keladigan 1–3 ta aniq taklif ber.",
    "Qoidalar:",
    "- Raqamlarni faqat berilgan ma'lumotdan ol va ko'chir; o'ylab topma. Taxmin qilsang, \"taxminan\" deb, hisobini ko'rsat.",
    "- Har bir taklif: nima uchun (raqamlar bilan), 3–6 qadamli reja, kutilgan natija (hisobi bilan), kim bajaradi, qanday o'lchanadi.",
    "- Chegirma yoki aksiya taklif qilsang, marjaga ta'sirini hisobla (marja ma'lumoti bo'lsa). Foydasiz aksiya taklif qilma.",
    "- postlar: kerak bo'lsa 1–3 ta tayyor post (matn 3–6 gap, oxirida chaqiriq; rasm_goyasi — dizayner uchun aniq tavsif). Kerak bo'lmasa bo'sh ro'yxat.",
    "- mijozlarga_xabar: segmentga yuboriladigan qisqa shaxsiy xabar ({ism} o'rniga ism qo'yiladi); segment kerak bo'lmasa \"yoq\" va bo'sh matn. mahsulot_xaridorlari uchun segment_parametr — mahsulot nomi; uxlab_qolgan uchun — kunlar soni.",
    "- vazifalar: aniq, bajariladigan, muddati bilan (1–14 kun).",
    "- olchov: tushum | mahsulot_tushumi (parametr: mahsulot nomi) | lidlar (parametr: manba, bo'lishi mumkin bo'sh) | qaytgan_mijozlar (segment bo'yicha) | qarz_yigildi (segment bo'yicha); kun: 7–30.",
    "- Xotirada rad etilgan takliflarni 30 kun takrorlama; ishlab turgan (approved) takliflarni takrorlama; ishlagan g'oyalardan foydalan.",
    "- Ma'lumot yetishmasa (masalan tannarx, reja, xarajatlar kiritilmagan), buni muammo sifatida ayt — bu ham muhim.",
    "- O'zbek tilida (lotin), qisqa va aniq. Markdown ishlatma.",
  ].join("\n");

  let running = false;
  const runBrief = async (reason = "schedule") => {
    if (running) return { skipped: true };
    running = true;
    try {
      const data = await loadAll();
      const reviews = await reviewDue(data);
      const snap = snapshot(data);
      const raw = snap._raw;
      delete snap._raw;
      const brief = await think(SYSTEM, JSON.stringify({ holat: snap, xotira: memoryOf(data) }), BRIEF, 20000);

      const r = snap.reja;
      const L = [`🧠 Bosh agent · ${todayCode()}`, ""];
      L.push(
        raw.plan
          ? `Reja: ${r.bajarildi} bajarildi (${r.oy_boshidan_tushum} / ${r.oylik_reja}). Shu sur'atda oy oxiri: ${r.shu_surat_bilan_oy_oxiri} (rejadan ${raw.projected >= raw.plan ? "+" : "−"}${money(Math.abs(raw.projected - raw.plan))}). Kuniga kerak: ${r.qolgan_kunlarda_kuniga_kerak}.`
          : `Oy boshidan tushum: ${r.oy_boshidan_tushum} (o'tgan oy shu davrda ${r.otgan_oy_shu_davrda}). Oylik reja kiritilmagan.`,
      );
      L.push(`Pul (30 kun): kirim ${snap.pul_oqimi_30_kun.kirim}, chiqim ${snap.pul_oqimi_30_kun.chiqim}, sof ${snap.pul_oqimi_30_kun.sof}.`);
      L.push(`Mijozlar qarzi: ${snap.debitorlik.jami} (60+ kun: ${snap.debitorlik.yoshi["60+ kun"]}). Ta'minotchilarga: ${snap.taminotchilarga_qarz.jami}.`);
      const alerts = [];
      if (snap.javobsiz_lidlar.soni) alerts.push(`${snap.javobsiz_lidlar.soni} ta javobsiz lid`);
      if (snap.kechikayotgan_buyurtmalar.soni) alerts.push(`${snap.kechikayotgan_buyurtmalar.soni} ta kechikayotgan buyurtma`);
      if (snap.kam_qolgan_materiallar.length) alerts.push(`${snap.kam_qolgan_materiallar.length} ta material kam`);
      if (alerts.length) L.push(`⚠️ ${alerts.join(" · ")}`);
      L.push("", brief.holat);
      if (brief.muammolar?.length) {
        L.push("", "🔴 Muammolar");
        for (const x of brief.muammolar.slice(0, 3)) L.push(`• ${x.sarlavha} — ${x.tafsilot}`);
      }
      if (brief.imkoniyatlar?.length) {
        L.push("", "🟢 Imkoniyatlar");
        for (const x of brief.imkoniyatlar.slice(0, 3)) L.push(`• ${x.sarlavha} — ${x.tafsilot}`);
      }
      if (reviews.length) L.push("", "📏 Tugagan takliflar natijasi", ...reviews);
      await post(L.join("\n"));

      const props = (brief.takliflar || []).slice(0, 3);
      const saved = [];
      for (let i = 0; i < props.length; i++) saved.push(await saveAndPostProposal(data, props[i], i + 1, props.length));

      await db.collection("chief_briefs").doc(todayCode()).set({ created_at: new Date().toISOString(), reason, snapshot: snap, brief, proposal_ids: saved.map((p) => p.id), reviews });
      await emitEvent(db, { agent: "chief", kind: "report", text: clip(brief.holat, 200), bubble: `${saved.length} ta taklif tayyor 💡`, source: reason });
      console.log(`Bosh agent brief sent (${reason}): ${saved.length} proposals, ${reviews.length} reviews`);
      return { proposals: saved.length, reviews: reviews.length };
    } finally {
      running = false;
    }
  };

  // ── approval ───────────────────────────────────────────────────────
  const assignee = (data, role, approver) => {
    const mod = ROLE_MODULE[role];
    const pick = mod && data.staff.find((s) => s.role !== "admin" && s.permissions?.[mod]?.edit);
    const s = pick || approver || data.staff.find((x) => x.role === "admin");
    return s ? { email: s.email || s.id, name: s.full_name || s.email || s.id } : { email: "", name: "" };
  };

  const approve = async (id, actorName, tgUserId) => {
    const ref = db.collection("chief_proposals").doc(id);
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().status !== "pending") return null;
      tx.update(ref, { status: "approving" });
      return snap.data();
    });
    if (!claimed) return { ok: false, message: "Bu taklif allaqachon ko'rib chiqilgan" };
    const p = claimed;
    const data = await loadAll();
    const today = todayCode();
    const days = Math.min(60, Math.max(3, Number(p.olchov?.kun) || 14));
    const baseline = measure(data, p, shiftDay(today, -days), shiftDay(today, -1));
    const approver = data.staff.find((s) => tgUserId && Number(s.telegram_chat_id) === Number(tgUserId)) || null;

    // ERP tasks
    const tasks = [];
    for (const v of p.vazifalar || []) {
      const who = v.kimga === "rahbar" ? assignee(data, null, approver) : assignee(data, v.kimga, approver);
      const t = await db.collection("tasks").add({
        title: clip(v.vazifa, 140),
        description: `Bosh agent taklifi: «${p.sarlavha}» (${today})\n\n${v.vazifa}`,
        assigned_to_email: who.email,
        assigned_to_name: who.name,
        assigned_by_email: "bosh-agent",
        assigned_by_name: "Bosh agent",
        due_date: shiftDay(today, Math.min(30, Math.max(1, Number(v.muddat_kun) || 3))),
        status: "new",
        started_at: null,
        completed_at: null,
        history: [{ status: "new", at: new Date().toISOString(), by_name: "Bosh agent", by_email: "bosh-agent" }],
        created_at: new Date().toISOString(),
        chief_proposal_id: id,
      });
      tasks.push({ id: t.id, kimga: who.name || ROLE_LABEL[v.kimga], vazifa: v.vazifa });
    }

    // Ready posts → Marketing topic; customer message + list → Sales topic
    if (p.postlar?.length) {
      const P = [`📝 Tayyor postlar — «${p.sarlavha}» (Bosh agent)`];
      p.postlar.forEach((x, i) => P.push("", `${i + 1}. ${x.format}`, x.matn, x.heshteglar || "", x.rasm_goyasi ? `🎨 Rasm: ${x.rasm_goyasi}` : ""));
      await post(P.join("\n").replace(/\n{3,}/g, "\n\n"), "mkt");
    }
    if (p.mijozlarga_xabar && p.segment_customers?.length) {
      const S = [`📨 Mijozlarga xabar — «${p.sarlavha}» (${p.segment_customers.length} ta)`, "", `Matn: ${p.mijozlarga_xabar}`, "({ism} o'rniga mijozning ismini qo'ying)", "", "Ro'yxat:"];
      for (const c of p.segment_customers) S.push(`• ${c.ism}${c.brend ? ` (${c.brend})` : ""} — ${c.telefon || c.telegram || "kontakt yo'q"}`);
      await post(S.join("\n"), "sales");
    }

    const review = shiftDay(today, days);
    await ref.update({
      status: "approved",
      approved_by: actorName,
      approved_date: today,
      approved_at: new Date().toISOString(),
      baseline,
      review_date: review,
      task_ids: tasks.map((t) => t.id),
    });
    await emitEvent(db, { agent: "chief", kind: "report", text: `Boshlandi: ${p.sarlavha}`, bubble: "Boshladik ✅", visit: p.agent || null, source: "telegram" });
    const summary = [
      `✅ Boshlandi — ${actorName}, ${today}`,
      tasks.length ? `Vazifalar: ${tasks.map((t) => `${t.kimga}: ${clip(t.vazifa, 60)}`).join("; ")}` : "",
      p.postlar?.length ? "Postlar «📣 Marketing» mavzusida." : "",
      p.mijozlarga_xabar && p.segment_customers?.length ? "Mijozlar ro'yxati «💼 Sotuv» mavzusida." : "",
      `Natija ${review} kuni o'lchanadi (hozirgi ${days} kun: ${fmtMetric(p, baseline)}).`,
    ]
      .filter(Boolean)
      .join("\n");
    return { ok: true, message: "Boshlandi ✅", summary, p };
  };

  const reject = async (id, actorName) => {
    const ref = db.collection("chief_proposals").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().status !== "pending") return { ok: false, message: "Bu taklif allaqachon ko'rib chiqilgan" };
    await ref.update({ status: "rejected", rejected_by: actorName, rejected_at: new Date().toISOString() });
    return { ok: true, message: "Rad etildi", summary: `❌ Rad etildi — ${actorName}. Sababini yozsangiz (shu xabarga javob), keyingi safar hisobga olaman.`, p: snap.data() };
  };

  // Callback from the ✅ / ❌ buttons (routed here by assistant.js).
  const handleCallback = async (cq, isWorkChat) => {
    const answer = (text, alert = false) => telegram("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });
    const m = /^chief:(ok|no):([A-Za-z0-9]+)$/.exec(cq.data || "");
    const chatId = cq.message?.chat?.id;
    if (!m || !chatId || !(await isWorkChat(chatId))) return answer("Ruxsat yo'q");
    if (!(await isChatAdmin(telegram, chatId, cq.from.id))) return answer("Faqat guruh adminlari tasdiqlay oladi", true);
    const actor = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(" ") || cq.from.username || String(cq.from.id);
    let res;
    try {
      res = m[1] === "ok" ? await approve(m[2], actor, cq.from.id) : await reject(m[2], actor);
    } catch (err) {
      console.error("Bosh agent decision failed", err);
      await db.collection("chief_proposals").doc(m[2]).update({ status: "pending" }).catch(() => undefined);
      return answer(`Xatolik: ${err.message}`, true);
    }
    if (res.ok && cq.message) {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: cq.message.message_id,
        text: `${cq.message.text}\n\n${res.summary}`.slice(0, 4000),
        link_preview_options: { is_disabled: true },
      });
    }
    return answer(res.message, !res.ok);
  };

  // ── questions and revisions in the topic ───────────────────────────
  const handleMessage = async (msg, text) => {
    const thread = msg.is_topic_message ? { message_thread_id: msg.message_thread_id } : {};
    const reply = async (t, extra = {}) => {
      const parts = chunks(t);
      for (let i = 0; i < parts.length; i++) {
        await telegram("sendMessage", {
          chat_id: msg.chat.id,
          ...thread,
          text: parts[i],
          reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
          link_preview_options: { is_disabled: true },
          ...(i === parts.length - 1 ? extra : {}),
        });
      }
    };
    if (/^\/brif\b/i.test(text)) {
      await reply("⏳ Bosh agent kompaniyani tahlil qilmoqda — 1–3 daqiqa…");
      await runBrief("command");
      return;
    }
    await telegram("sendChatAction", { chat_id: msg.chat.id, action: "typing", ...thread });
    const data = await loadAll();
    const repliedId = msg.reply_to_message?.message_id;
    const original = repliedId ? data.proposals.find((p) => p.tg_message_id === repliedId) : null;

    if (original) {
      // Feedback on a proposal: rejected ones keep the reason as memory;
      // pending ones are rewritten and posted again.
      if (original.status === "rejected") {
        await db.collection("chief_proposals").doc(original.id).update({ feedback: clip(text, 500) });
        await reply("Tushundim, sababini eslab qolaman — keyingi takliflarda hisobga olaman.");
        return;
      }
      if (original.status !== "pending") {
        await db.collection("chief_proposals").doc(original.id).update({ notes: [...(original.notes || []), clip(text, 500)] });
        await reply("Izohni taklifga qo'shdim.");
        return;
      }
      const snap = snapshot(data);
      delete snap._raw;
      const keep = Object.fromEntries(Object.keys(PROPOSAL.properties).map((k) => [k, original[k]]));
      const revised = await think(
        `${SYSTEM}\nRahbar taklifingizga izoh berdi. Taklifni izohga moslab qayta yoz (bitta taklif).`,
        JSON.stringify({ holat: snap, taklif: keep, rahbar_izohi: text }),
        PROPOSAL,
        12000,
      );
      await db.collection("chief_proposals").doc(original.id).update({ status: "revised", feedback: clip(text, 500) });
      if (original.tg_chat_id && original.tg_message_id) {
        await telegram("editMessageReplyMarkup", { chat_id: original.tg_chat_id, message_id: original.tg_message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
      }
      await saveAndPostProposal(data, revised, 1, 1, { revised_from: original.id });
      return;
    }

    const snap = snapshot(data);
    delete snap._raw;
    const out = await think(
      `${SYSTEM}\nHozir rahbar savol berdi yoki topshiriq berdi. Holat va xotiraga tayanib, aniq javob ber: avval xulosa, keyin tafsilot va tavsiya. Oddiy matn.`,
      JSON.stringify({ holat: snap, xotira: memoryOf(data), savol: text, oldingi_xabar: msg.reply_to_message?.text || "" }),
      null,
      16000,
    );
    await reply(out || "Javob topilmadi.");
    await emitEvent(db, { agent: "chief", kind: "report", text: clip(out, 200), bubble: clip(out, 80), source: "telegram" });
  };

  // ── schedule ───────────────────────────────────────────────────────
  let timer = null;
  const tick = async () => {
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const min = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (now.getUTCDay() === 0 || min < BRIEF_AT_MIN || min > BRIEF_AT_MIN + 180) return;
    const run = db.collection("chief_runs").doc(todayCode());
    try {
      await run.create({ started_at: new Date().toISOString() });
    } catch {
      return;
    }
    try {
      const r = await runBrief("schedule");
      await run.update({ done_at: new Date().toISOString(), ...r });
    } catch (err) {
      console.error("Bosh agent brief failed", err);
      await run.update({ error: err.message });
      await post(`🧠 Bosh agent bugungi tahlilni tayyorlay olmadi: ${err.message}`).catch(() => undefined);
    }
  };

  const register = (app) => {
    app.post("/webhooks/chief/run", async (req, res) => {
      const who = await staffFromRequest(db, req);
      if (!who || who.role !== "admin") return res.status(403).json({ error: "Faqat admin" });
      res.status(202).json({ started: true });
      runBrief("web").catch((err) => console.error("Bosh agent run failed", err));
    });
  };

  const start = async () => {
    await tick();
    timer = setInterval(() => tick().catch((err) => console.error("Bosh agent tick failed", err)), 60 * 1000);
    console.log(`Bosh agent started (daily 08:30 Mon–Sat, model ${MODEL})`);
  };
  const stop = () => clearInterval(timer);

  return { register, start, stop, tick, runBrief, handleMessage, handleCallback, _test: { snapshot, loadAll, measure, resolveSegment, approve, reject } };
};

module.exports = { create, PROPOSAL, BRIEF };
