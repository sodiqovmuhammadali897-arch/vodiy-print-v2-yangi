// "Hisobchi" — answers finance/business questions typed into the
// Telegram report channel ("Kans Printga qancha qarzimiz bor?",
// "bizdan qancha qarzdorlik bor?"). Telegram pushes every channel post to
// /webhooks/telegram; Claude reads the question, calls the read-only
// Firestore tools below for real numbers, and the answer is posted as a
// reply. Only chats listed in ASSISTANT_CHAT_IDS are ever answered.
const crypto = require("crypto");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || process.env.MOIZVONKI_CALLBACK_BASE || "https://printvodiy.uz";
const ALLOWED_CHATS = new Set(
  (process.env.ASSISTANT_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
// Regenerated on every start and re-registered with Telegram, so it never
// needs to be stored anywhere; it proves a request really came from
// Telegram.
const WEBHOOK_SECRET = crypto.randomBytes(24).toString("hex");
const {
  VENDOR_EXPENSE_CATEGORY,
  ORDER_STATUS_LABELS,
  todayCode,
  dayCodeOf,
  money,
  orderDebt,
  customerName,
  norm,
  matches,
  createReader,
  emitEvent,
  clip,
} = require("./shared");
const { ACTION_TOOLS, createActionTools, sendConfirmations, handleCallback, decideAction } = require("./actions");
const { telegram, sendDocument, BOT_TOKEN } = require("./telegram");
const { buildPriceSheet } = require("./pdf");
const { staffFromRequest } = require("./auth");

const TOOLS = [
  {
    name: "receivables",
    description:
      "Mijozlarning BIZGA qarzi (debitorlik). customer bo'lmasa — jami qarz va eng katta qarzdorlar. customer berilsa — o'sha mijoz(lar)ning qarzi buyurtmalari bilan.",
    input_schema: {
      type: "object",
      properties: { customer: { type: "string", description: "Mijoz ismi, kompaniyasi yoki telefoni (ixtiyoriy)" } },
    },
  },
  {
    name: "supplier_balances",
    description:
      "Ta'minotchilarga (masalan Kans Print) BIZNING qarzimiz: hisob-fakturalar − to'lovlar. supplier bo'lmasa — hammasi; berilsa — o'sha ta'minotchi va oxirgi yozuvlari.",
    input_schema: {
      type: "object",
      properties: { supplier: { type: "string", description: "Ta'minotchi nomi (ixtiyoriy)" } },
    },
  },
  {
    name: "cash_flow",
    description:
      "Davr bo'yicha pul oqimi: mijozlardan kelgan to'lovlar (to'lov turi bo'yicha), xarajatlar (turi bo'yicha), ta'minotchilarga to'lovlar, sof qoldiq, shu davrda ochilgan buyurtmalar summasi.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD, shu kun ham kiradi" },
        to: { type: "string", description: "YYYY-MM-DD, shu kun ham kiradi" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "orders_search",
    description: "Buyurtmalarni qidirish: raqam, nom, mijoz yoki menejer bo'yicha; faqat muddati o'tganlar yoki faqat qarzi borlar.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Buyurtma raqami (VP-098), nomi, mijoz yoki menejer ismi" },
        status: { type: "string", enum: Object.keys(ORDER_STATUS_LABELS) },
        only_overdue: { type: "boolean" },
        only_with_debt: { type: "boolean" },
        include_finished: { type: "boolean", description: "Yetkazilgan/yopilgan buyurtmalar ham kirsin" },
      },
    },
  },
  {
    name: "leads_summary",
    description: "Davr bo'yicha lidlar: nechta kelgan, manba, menejer va holat bo'yicha, nechtasi buyurtmaga aylangan.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    },
  },
  {
    name: "warehouse_stock",
    description: "Ombordagi materiallar qoldig'i va minimal chegarasi.",
    input_schema: { type: "object", properties: { query: { type: "string" } } },
  },
];

const createTools = (db) => {
  const all = createReader(db);

  return {
    async receivables({ customer }) {
      const [orders, customers] = await Promise.all([all("orders"), all("customers")]);
      const withDebt = orders.filter((o) => o.status !== "cancelled" && !o.is_draft && orderDebt(o) > 0);
      const byId = new Map(customers.map((c) => [c.id, c]));
      if (!customer) {
        const per = new Map();
        for (const o of withDebt) per.set(o.customer_id || "-", (per.get(o.customer_id || "-") || 0) + orderDebt(o));
        const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
        return {
          jami_qarz: money(withDebt.reduce((s, o) => s + orderDebt(o), 0)),
          qarzdor_mijozlar_soni: per.size,
          qarzli_buyurtmalar_soni: withDebt.length,
          eng_katta_qarzdorlar: top.map(([id, d]) => ({ mijoz: byId.get(id) ? customerName(byId.get(id)) : "Mijozsiz buyurtma", qarz: money(d) })),
        };
      }
      const found = customers.filter((c) => matches(customer, c.first_name, c.last_name, c.company, c.phone, c.extra_phone));
      if (found.length === 0) return { natija: `"${customer}" nomli mijoz topilmadi` };
      return found.slice(0, 5).map((c) => {
        const own = withDebt.filter((o) => o.customer_id === c.id);
        return {
          mijoz: customerName(c),
          kompaniya: c.company || undefined,
          telefon: c.phone || undefined,
          jami_qarz: money(own.reduce((s, o) => s + orderDebt(o), 0)),
          buyurtmalar: own.map((o) => ({
            raqam: o.order_number,
            nomi: o.title,
            holati: ORDER_STATUS_LABELS[o.status] || o.status,
            summa: money(o.total_amount),
            tolangan: money(o.paid_amount),
            qarz: money(orderDebt(o)),
          })),
        };
      });
    },

    async supplier_balances({ supplier }) {
      const [vendors, invoices, expenses] = await Promise.all([
        all("production_companies"),
        all("supplier_invoices"),
        all("expenses"),
      ]);
      const payments = expenses.filter((e) => e.category === VENDOR_EXPENSE_CATEGORY && e.vendor_id);
      const rows = vendors
        .filter((v) => !v.is_internal && matches(supplier, v.name))
        .map((v) => {
          const inv = invoices.filter((i) => i.vendor_id === v.id);
          const pay = payments.filter((p) => p.vendor_id === v.id);
          const invoiced = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
          const paid = pay.reduce((s, p) => s + Number(p.amount || 0), 0);
          return { v, inv, pay, invoiced, paid, balance: invoiced - paid };
        })
        .filter((r) => supplier || r.invoiced > 0 || r.paid > 0)
        .sort((a, b) => b.balance - a.balance);
      if (rows.length === 0) return { natija: supplier ? `"${supplier}" nomli ta'minotchi topilmadi` : "Ta'minotchilar bo'yicha yozuv yo'q" };
      const shape = (r, detail) => ({
        taminotchi: r.v.name,
        hisob_fakturalar: money(r.invoiced),
        tolangan: money(r.paid),
        qarzimiz: r.balance >= 0 ? money(r.balance) : `0 so'm (${money(-r.balance)} avans/ortiqcha to'langan)`,
        ...(r.inv.length === 0 ? { eslatma: "Bu ta'minotchi uchun hisob-faktura hali kiritilmagan — qarz faqat kiritilgan fakturalardan hisoblanadi" } : {}),
        ...(detail
          ? {
              oxirgi_yozuvlar: [
                ...r.inv.map((i) => ({ sana: i.date, turi: "hisob-faktura", summa: money(i.amount), izoh: [i.order_number, i.note].filter(Boolean).join(" · ") })),
                ...r.pay.map((p) => ({ sana: p.date, turi: "to'lov", summa: money(p.amount), izoh: p.note })),
              ]
                .sort((a, b) => String(b.sana).localeCompare(String(a.sana)))
                .slice(0, 15),
            }
          : {}),
      });
      if (supplier) return rows.slice(0, 3).map((r) => shape(r, true));
      return {
        jami_qarzimiz: money(rows.reduce((s, r) => s + Math.max(0, r.balance), 0)),
        taminotchilar: rows.map((r) => shape(r, false)),
      };
    },

    async cash_flow({ from, to }) {
      const [payments, expenses, orders] = await Promise.all([all("order_payments"), all("expenses"), all("orders")]);
      const inRange = (d) => d >= from && d <= to;
      const pay = payments.filter((p) => inRange(dayCodeOf(p.payment_date || p.created_at)));
      const exp = expenses.filter((e) => inRange(dayCodeOf(e.date || e.created_at)));
      const newOrders = orders.filter((o) => o.status !== "cancelled" && !o.is_draft && !o.is_historical && inRange(dayCodeOf(o.order_date || o.created_at)));
      const group = (items, key) => {
        const m = new Map();
        for (const x of items) m.set(key(x) || "Boshqa", (m.get(key(x) || "Boshqa") || 0) + Number(x.amount || 0));
        return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, money(v)]));
      };
      const inSum = pay.reduce((s, p) => s + Number(p.amount || 0), 0);
      const outSum = exp.reduce((s, e) => s + Number(e.amount || 0), 0);
      return {
        davr: `${from} — ${to}`,
        mijozlardan_tushum: money(inSum),
        tolovlar_soni: pay.length,
        tolov_turi_boyicha: group(pay, (p) => p.payment_type),
        xarajat: money(outSum),
        xarajat_turi_boyicha: group(exp, (e) => e.category),
        taminotchilarga_tolov: group(exp.filter((e) => e.category === VENDOR_EXPENSE_CATEGORY), (e) => e.vendor_name),
        sof_qoldiq: money(inSum - outSum),
        yangi_buyurtmalar: { soni: newOrders.length, summasi: money(newOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)) },
      };
    },

    async orders_search({ query, status, only_overdue, only_with_debt, include_finished }) {
      const [orders, customers] = await Promise.all([all("orders"), all("customers")]);
      const byId = new Map(customers.map((c) => [c.id, c]));
      const today = todayCode();
      const finished = new Set(["delivered", "closed", "cancelled"]);
      const list = orders
        .filter((o) => !o.is_draft)
        .filter((o) => include_finished || status || !finished.has(o.status))
        .filter((o) => !status || o.status === status)
        .filter((o) => !only_overdue || (o.deadline && dayCodeOf(o.deadline) < today && !finished.has(o.status)))
        .filter((o) => !only_with_debt || (o.status !== "cancelled" && orderDebt(o) > 0))
        .filter((o) => {
          const c = byId.get(o.customer_id);
          return matches(query, o.order_number, o.title, o.manager_name, c && customerName(c), c && c.company, c && c.phone);
        })
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return {
        topildi: list.length,
        buyurtmalar: list.slice(0, 20).map((o) => ({
          raqam: o.order_number,
          nomi: o.title,
          mijoz: byId.get(o.customer_id) ? customerName(byId.get(o.customer_id)) : undefined,
          menejer: o.manager_name || undefined,
          holati: ORDER_STATUS_LABELS[o.status] || o.status,
          summa: money(o.total_amount),
          qarz: money(orderDebt(o)),
          muddat: o.deadline || undefined,
          sana: dayCodeOf(o.order_date || o.created_at),
        })),
      };
    },

    async leads_summary({ from, to }) {
      const leads = await all("leads");
      const list = leads.filter((l) => {
        const d = dayCodeOf(l.created_at);
        return d >= from && d <= to;
      });
      const count = (key) => {
        const m = new Map();
        for (const l of list) m.set(key(l) || "—", (m.get(key(l) || "—") || 0) + 1);
        return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
      };
      return {
        davr: `${from} — ${to}`,
        jami: list.length,
        manba_boyicha: count((l) => l.source),
        menejer_boyicha: count((l) => l.assigned_to_name || "biriktirilmagan"),
        holat_boyicha: count((l) => l.status),
        buyurtmaga_aylangan: list.filter((l) => l.converted_order_id).length,
      };
    },

    async warehouse_stock({ query }) {
      const items = await all("warehouse_items");
      return items
        .filter((i) => matches(query, i.name, i.category))
        .map((i) => ({
          nomi: i.name,
          qoldiq: `${Number(i.quantity || 0)} ${i.unit || ""}`.trim(),
          minimum: Number(i.min_threshold || 0),
          holat: Number(i.quantity || 0) <= 0 ? "tugagan" : Number(i.quantity) <= Number(i.min_threshold || 0) ? "kam qolgan" : "yetarli",
        }));
    },
  };
};

// Tools that produce a file for the channel instead of data for Claude.
const FILE_TOOLS = [
  {
    name: "product_price_pdf",
    description:
      "Mahsulotning MIJOZGA ko'rsatiladigan narxlar varag'ini PDF qilib kanalga yuboradi (tannarxsiz: tiraj bo'yicha narxlar, xususiyatlar, kompaniya kontaktlari). Mahsulot nomi yoki kodi bo'yicha topadi.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Mahsulot nomi yoki kodi, masalan \"Paket 45\" yoki \"45\"" },
        quantity: { type: "number", description: "Mijoz so'ragan tiraj bo'lsa — PDF'da shu miqdor uchun jami summa ham chiqadi" },
      },
      required: ["product"],
    },
  },
];

const createFileTools = (db, ctx) => {
  const all = createReader(db);
  return {
    async product_price_pdf({ product, quantity }) {
      const products = (await all("products")).filter((p) => p.is_active !== false && !p.archived_at);
      const digits = String(product || "").replace(/\D/g, "").replace(/^0+/, "");
      const byCode = digits ? products.filter((p) => String(p.product_code || "").replace(/\D/g, "").replace(/^0+/, "") === digits) : [];
      const words = String(product || "").replace(/\d+/g, " ").trim();
      let found = byCode.length ? byCode : products.filter((p) => matches(product, p.name, p.product_code, p.category));
      if (found.length > 1 && words) {
        const narrowed = found.filter((p) => matches(words, p.name, p.category));
        if (narrowed.length) found = narrowed;
      }
      if (found.length === 0 && words) found = products.filter((p) => matches(words, p.name, p.product_code, p.category));
      if (found.length === 0) return { xato: `"${product}" mahsuloti topilmadi` };
      if (found.length > 1) {
        return { xato: "Bir nechta mahsulot mos keldi — qaysi biri?", variantlar: found.slice(0, 10).map((p) => `${p.name}${p.product_code ? ` (kod ${p.product_code})` : ""}`) };
      }
      const p = found[0];
      const companySnap = await db.collection("company_settings").doc("main").get();
      const qty = Number(quantity) > 0 ? Math.round(Number(quantity)) : 0;
      const buffer = await buildPriceSheet({ product: p, company: companySnap.exists ? companySnap.data() : {}, quantity: qty });
      const safe = String(p.name || "mahsulot").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "mahsulot";
      ctx.files.push({ buffer, filename: `${safe}-narxlar.pdf`, caption: `📄 ${p.name} — narxlar (mijoz uchun)${qty ? ` · ${qty} ${p.unit || "dona"}` : ""}` });
      return { tayyor: true, mahsulot: p.name, kod: p.product_code || undefined, tirajlar_soni: (p.price_tiers || []).length, eslatma: "PDF kanalga fayl bo'lib yuboriladi" };
    },
  };
};

const systemPrompt = () =>
  [
    "Sen Vodiy Print poligrafiya kompaniyasining hisobchisisan. Rahbar Telegram kanalida savol yozadi, sen javob berasan.",
    `Bugun: ${todayCode()} (Toshkent vaqti).`,
    "Qoidalar:",
    "- Raqamlarni faqat vositalar (tools) qaytargan ma'lumotdan ol, hech qachon o'ylab topma. Summalar vositalarda tayyor formatda keladi — o'zgartirmay ko'chir.",
    "- \"Qarzdorlik\", \"bizdan qarz\", \"mijozlar qarzi\" — mijozlarning bizga qarzi (receivables).",
    "- \"Kans Printga qarzimiz\", \"ta'minotchiga qancha qarzmiz\" — supplier_balances. Agar eslatma bo'lsa (faktura kiritilmagan), buni albatta ayt.",
    "- Davr aytilmasa: \"bugun\" — bugungi kun, \"kecha\" — kechagi, \"bu oy\" — oy boshidan bugungacha; boshqa hollarda bu oyni ol va qaysi davrni olganingni ayt.",
    "- Javob o'zbek tilida (lotin), qisqa va aniq: avval asosiy raqam, keyin kerak bo'lsa 3–10 qatorlik tafsilot.",
    "- Telegram oddiy matn: Markdown (**, #, ```) ishlatma. Ro'yxat uchun \"•\" ishlat.",
    "- Savol kompaniya ishiga aloqasiz bo'lsa, bir gap bilan javob ber.",
    "O'zgartirishlar (holat, to'lov, xarajat, ta'minotchi fakturasi, ombor kirim/chiqim):",
    "- Tegishli propose_* vositasini chaqir. Sen hech narsani o'zing o'zgartirmaysan — bot tasdiqlash tugmali xabar yuboradi, admin bosgandagina bajariladi.",
    "- Taklif tayyor bo'lsa, javobing bitta qisqa gap bo'lsin (masalan: \"Quyidagini tasdiqlang 👇\"); tafsilotni takrorlama. Hech qachon \"bajarildi\" dema.",
    "- Summalar: \"2 mln\" = 2000000, \"500 ming\" = 500000, \"1,5 mln\" = 1500000. Sana aytilmasa bugun. To'lov turi aytilmasa Naqd.",
    "- Buyurtma raqami aytilmasa, avval orders_search bilan top; bitta aniq buyurtma topilmasa, variantlarni ko'rsatib so'ra.",
    "- Vosita xato yoki variantlar qaytarsa, buni foydalanuvchiga tushuntir va aniqlashtirishni so'ra.",
    "Fayllar: mahsulot narxini PDF / mijozga narx varag'i so'ralsa product_price_pdf ni chaqir. PDF kanalga o'zi yuboriladi — javobda bir qisqa gap yoz (masalan \"PDF tayyor 👇\").",
  ].join("\n");

const callClaude = async (messages, tools) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: systemPrompt(), tools, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  return data;
};

// ctx.pending collects the actions proposed while answering, so the
// caller can post their confirmation buttons after the reply.
const answer = async (db, question, context, ctx) => {
  const tools = { ...createTools(db), ...createActionTools(db, ctx), ...createFileTools(db, ctx) };
  const toolDefs = [...TOOLS, ...ACTION_TOOLS, ...FILE_TOOLS];
  const content = context ? `Oldingi xabar (kontekst):\n${context}\n\nSavol:\n${question}` : question;
  const messages = [{ role: "user", content }];
  for (let step = 0; step < 6; step += 1) {
    const reply = await callClaude(messages, toolDefs);
    if (reply.stop_reason !== "tool_use") {
      return reply.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    }
    messages.push({ role: "assistant", content: reply.content });
    const results = [];
    for (const block of reply.content.filter((b) => b.type === "tool_use")) {
      ctx.toolsUsed.push(block.name);
      let out;
      try {
        out = await tools[block.name](block.input || {});
      } catch (err) {
        out = { xato: err.message };
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }
  return "Savol juda murakkab bo'lib ketdi — iltimos, aniqroq so'rang.";
};

// Which colleague the Hisobchi "walks to" on the AI Ofis page, by the
// first data tool it used to answer.
const TOOL_VISIT = { product_price_pdf: "sales", receivables: "fin", cash_flow: "fin", supplier_balances: "fin", orders_search: "prod", leads_summary: "sales", warehouse_stock: "wh" };

// One path for a question from the Telegram channel or from the website:
// answer it in the channel (as a reply), post confirmation buttons for any
// proposed change, and emit the AI Ofis events.
const handleQuestion = async (db, { chatId, replyTo, text, context = "", source = "telegram" }) => {
  await emitEvent(db, { agent: "bot", kind: "question", text: clip(text, 160), bubble: clip(text, 90), source });
  await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
  const ctx = { chatId, text, pending: [], toolsUsed: [], files: [] };
  const reply = (await answer(db, text, context, ctx)) || "Javob topilmadi.";
  await telegram("sendMessage", {
    chat_id: chatId,
    text: reply.slice(0, 4000),
    reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
    disable_web_page_preview: true,
  });
  for (const f of ctx.files) await sendDocument({ chatId, buffer: f.buffer, filename: f.filename, caption: f.caption, replyTo });
  await sendConfirmations(db, telegram, chatId, replyTo, ctx.pending);
  const visit = ctx.toolsUsed.map((t) => TOOL_VISIT[t]).find(Boolean) || null;
  await emitEvent(db, ctx.pending.length
    ? { agent: "bot", kind: "proposed", text: clip(ctx.pending[0].summary.replace(/\n/g, " · "), 180), bubble: "Tasdiqlaysizmi? ⏳", source }
    : { agent: "bot", kind: "answer", text: clip(reply, 220), bubble: clip(reply, 90), visit, source });
  console.log(`Hisobchi answered (${source}) in ${chatId}: ${text.slice(0, 80)}${ctx.pending.length ? ` (+${ctx.pending.length} to confirm)` : ""}`);
  return { reply, pending: ctx.pending, files: ctx.files.map((f) => f.filename) };
};

const register = (app, db, hr = null) => {
  const configured = Boolean(BOT_TOKEN && ANTHROPIC_API_KEY && ALLOWED_CHATS.size > 0);
  if (!configured) {
    console.log("Hisobchi bot: TELEGRAM_BOT_TOKEN / ANTHROPIC_API_KEY / ASSISTANT_CHAT_IDS not all set — not enabled.");
    return { start: () => {} };
  }
  const mainChat = [...ALLOWED_CHATS][0];

  app.post("/webhooks/telegram", async (req, res) => {
    if (req.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) return res.sendStatus(401);
    res.sendStatus(200); // ack first; Telegram retries slow webhooks

    if (req.body?.callback_query) {
      try {
        await handleCallback(db, telegram, req.body.callback_query, ALLOWED_CHATS);
      } catch (err) {
        console.error("Hisobchi callback failed", err);
      }
      return;
    }

    const msg = req.body?.channel_post || req.body?.message;
    const text = msg?.text?.trim();
    if (msg?.chat?.type === "private") {
      if (hr && text) await hr.handlePrivateMessage(msg).catch((err) => console.error("HR private message failed", err));
      return;
    }
    if (!msg || !text || msg.from?.is_bot || !ALLOWED_CHATS.has(String(msg.chat?.id))) return;

    try {
      await handleQuestion(db, { chatId: msg.chat.id, replyTo: msg.message_id, text, context: msg.reply_to_message?.text || "" });
    } catch (err) {
      console.error("Hisobchi failed", err);
      await telegram("sendMessage", {
        chat_id: msg.chat.id,
        text: "Kechirasiz, hozir javob bera olmadim. Birozdan keyin qayta so'rang.",
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    }
  });

  // ── Website (AI Ofis page) ───────────────────────────────
  // Same bot, asked from printvodiy.uz. The caller must be a signed-in
  // staff admin (Firebase ID token); the question and answer are also
  // posted to the Telegram channel so the team sees everything in one place.
  const webAdmin = async (req) => {
    const who = await staffFromRequest(db, req);
    return who && who.role === "admin" ? who : null;
  };
  const recent = new Map(); // email -> timestamps, a simple per-user rate limit
  const tooFast = (email) => {
    const now = Date.now();
    const list = (recent.get(email) || []).filter((t) => now - t < 60000);
    list.push(now);
    recent.set(email, list);
    return list.length > 15;
  };

  app.post("/webhooks/assistant", async (req, res) => {
    const who = await webAdmin(req);
    if (!who) return res.status(403).json({ error: "Faqat admin buyruq bera oladi" });
    const text = String(req.body?.text || "").trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: "Buyruq bo'sh" });
    if (tooFast(who.email)) return res.status(429).json({ error: "Juda ko'p so'rov — bir daqiqa kuting" });
    try {
      const posted = await telegram("sendMessage", { chat_id: mainChat, text: `🌐 Saytdan · ${who.name}:\n${text}` });
      const replyTo = posted?.result?.message_id;
      const out = await handleQuestion(db, { chatId: mainChat, replyTo, text, source: "web" });
      res.json({ reply: out.reply, pending: out.pending.map((p) => ({ id: p.id, summary: p.summary })) });
    } catch (err) {
      console.error("Hisobchi web failed", err);
      res.status(500).json({ error: "Hozir javob bera olmadim. Birozdan keyin qayta urinib ko'ring." });
    }
  });

  app.post("/webhooks/assistant/confirm", async (req, res) => {
    const who = await webAdmin(req);
    if (!who) return res.status(403).json({ error: "Faqat admin tasdiqlay oladi" });
    const id = String(req.body?.id || "");
    if (!/^[A-Za-z0-9]{1,64}$/.test(id)) return res.status(400).json({ error: "Noto'g'ri so'rov" });
    try {
      const out = await decideAction(db, telegram, id, Boolean(req.body?.ok), who.name, { via: "web" });
      res.json(out);
    } catch (err) {
      console.error("Hisobchi web confirm failed", err);
      res.status(500).json({ error: "Tasdiqlab bo'lmadi" });
    }
  });

  const start = async () => {
    const url = `${PUBLIC_BASE}/webhooks/telegram`;
    const data = await telegram("setWebhook", {
      url,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ["message", "channel_post", "callback_query"],
      drop_pending_updates: true,
    });
    if (data.ok) console.log(`Hisobchi bot webhook set: ${url} (chats: ${[...ALLOWED_CHATS].join(", ")}, model ${MODEL})`);
  };
  return { start };
};

module.exports = { register, createTools, norm, matches };
