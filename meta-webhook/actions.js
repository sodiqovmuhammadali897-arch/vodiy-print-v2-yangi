// Write actions for the Hisobchi bot. Claude never changes data directly:
// a propose_* tool resolves what was asked (order, supplier, material),
// stores it as a pending record in `bot_actions` and the bot posts it with
// ✅ / ❌ buttons. Only a chat administrator's tap executes it, using the
// same rules as the web app. `bot_actions` doubles as the audit log.
const {
  VENDOR_EXPENSE_CATEGORY,
  EXPENSE_CATEGORIES,
  PAYMENT_TYPES,
  ORDER_STATUS_LABELS,
  todayCode,
  money,
  orderDebt,
  customerName,
  norm,
  matches,
  createReader,
  emitEvent,
  clip,
} = require("./shared");

const PENDING_TTL_MS = 30 * 60 * 1000;
const ADMIN_CACHE_MS = 5 * 60 * 1000;

const dateOrToday = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d : todayCode());
const positive = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error("Summa yoki miqdor 0 dan katta bo'lishi kerak");
  return v;
};

const ACTION_TOOLS = [
  {
    name: "propose_order_status",
    description: "Buyurtma holatini o'zgartirishni TAKLIF qilish (foydalanuvchi tugma bilan tasdiqlaydi).",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Masalan VP-125 yoki 125" },
        status: { type: "string", enum: Object.keys(ORDER_STATUS_LABELS) },
      },
      required: ["order_number", "status"],
    },
  },
  {
    name: "propose_customer_payment",
    description: "Mijozdan buyurtma uchun to'lov qabul qilishni TAKLIF qilish. Buyurtma qarzi avtomatik kamayadi.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        amount: { type: "number", description: "so'mda, masalan 2 mln = 2000000" },
        payment_type: { type: "string", enum: PAYMENT_TYPES, description: "Aytilmasa Naqd" },
        date: { type: "string", description: "YYYY-MM-DD, aytilmasa bugun" },
        note: { type: "string" },
      },
      required: ["order_number", "amount"],
    },
  },
  {
    name: "propose_expense",
    description: `Xarajat yozishni TAKLIF qilish. Ta'minotchiga to'lov bo'lsa category="${VENDOR_EXPENSE_CATEGORY}" va supplier majburiy.`,
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: EXPENSE_CATEGORIES },
        amount: { type: "number" },
        supplier: { type: "string", description: "Ta'minotchi nomi (faqat ta'minotchiga to'lovda)" },
        date: { type: "string" },
        note: { type: "string" },
      },
      required: ["category", "amount"],
    },
  },
  {
    name: "propose_supplier_invoice",
    description: "Ta'minotchi bergan hisob-fakturani (bizning unga qarzimiz oshadi) yozishni TAKLIF qilish.",
    input_schema: {
      type: "object",
      properties: {
        supplier: { type: "string" },
        amount: { type: "number" },
        order_number: { type: "string", description: "Qaysi buyurtma uchun (ixtiyoriy)" },
        date: { type: "string" },
        note: { type: "string" },
      },
      required: ["supplier", "amount"],
    },
  },
  {
    name: "propose_warehouse_move",
    description: "Omborga kirim (keldi) yoki chiqim (olindi/ishlatildi) yozishni TAKLIF qilish.",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Material nomi" },
        direction: { type: "string", enum: ["in", "out"], description: "in = kirim, out = chiqim" },
        quantity: { type: "number" },
        reason: { type: "string" },
        date: { type: "string" },
      },
      required: ["item", "direction", "quantity"],
    },
  },
];

// Order numbers are typed loosely ("vp125", "VP-125", "125").
const findOrders = (orders, ref) => {
  const digits = String(ref || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return [];
  return orders.filter((o) => String(o.order_number || "").replace(/\D/g, "").replace(/^0+/, "") === digits);
};

// Exact (normalized) name wins over partial matches, so "Kans Print"
// doesn't become ambiguous next to "Kans Print 2".
const pickOne = (list, query, nameOf) => {
  const found = list.filter((x) => matches(query, nameOf(x)));
  const exact = found.filter((x) => norm(nameOf(x)) === norm(query));
  return exact.length === 1 ? exact : found;
};

const createActionTools = (db, ctx) => {
  const all = createReader(db);

  const propose = async (kind, params, summary) => {
    const ref = await db.collection("bot_actions").add({
      kind,
      params,
      summary,
      status: "pending",
      chat_id: String(ctx.chatId),
      requested_text: ctx.text,
      created_at: new Date().toISOString(),
    });
    ctx.pending.push({ id: ref.id, summary });
    return { taklif_tayyor: true, xulosa: summary, eslatma: "Hali bajarilmadi — foydalanuvchi tugmani bosib tasdiqlashi kerak" };
  };

  const oneOrder = async (orderNumber) => {
    const found = findOrders(await all("orders"), orderNumber).filter((o) => !o.is_draft);
    if (found.length === 0) return { error: { xato: `${orderNumber} raqamli buyurtma topilmadi` } };
    if (found.length > 1) return { error: { xato: "Bir nechta buyurtma mos keldi", variantlar: found.map((o) => o.order_number) } };
    return { order: found[0] };
  };

  const oneVendor = async (name) => {
    const vendors = (await all("production_companies")).filter((v) => !v.is_internal);
    const found = pickOne(vendors, name, (v) => v.name);
    if (found.length === 0) return { error: { xato: `"${name}" nomli ta'minotchi topilmadi — avval saytda qo'shing`, mavjudlar: vendors.map((v) => v.name) } };
    if (found.length > 1) return { error: { xato: "Bir nechta ta'minotchi mos keldi", variantlar: found.map((v) => v.name) } };
    return { vendor: found[0] };
  };

  const vendorBalance = async (vendorId) => {
    const [invoices, expenses] = await Promise.all([all("supplier_invoices"), all("expenses")]);
    const inv = invoices.filter((i) => i.vendor_id === vendorId).reduce((s, i) => s + Number(i.amount || 0), 0);
    const paid = expenses
      .filter((e) => e.category === VENDOR_EXPENSE_CATEGORY && e.vendor_id === vendorId)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return inv - paid;
  };

  const orderTitle = async (o) => {
    const c = (await all("customers")).find((x) => x.id === o.customer_id);
    return `${o.order_number} «${o.title || "—"}»${c ? ` (${customerName(c)})` : ""}`;
  };

  return {
    async propose_order_status({ order_number, status }) {
      const { order, error } = await oneOrder(order_number);
      if (error) return error;
      if (!ORDER_STATUS_LABELS[status]) return { xato: "Noma'lum holat" };
      if (order.status === status) return { xato: `Buyurtma allaqachon "${ORDER_STATUS_LABELS[status]}" holatida` };
      if (status === "closed" && orderDebt(order) > 0) {
        return { xato: `Bu buyurtmada ${money(orderDebt(order))} qarz bor — avval to'lovni kiritmasdan yopib bo'lmaydi` };
      }
      return propose(
        "order_status",
        { order_id: order.id, status },
        `📦 ${await orderTitle(order)}\nHolati: ${ORDER_STATUS_LABELS[order.status] || order.status} → ${ORDER_STATUS_LABELS[status]}`,
      );
    },

    async propose_customer_payment({ order_number, amount, payment_type, date, note }) {
      const { order, error } = await oneOrder(order_number);
      if (error) return error;
      const value = positive(amount);
      const type = PAYMENT_TYPES.includes(payment_type) ? payment_type : "Naqd";
      const debt = orderDebt(order);
      const after = Math.max(0, debt - value);
      const over = value > debt ? `\n⚠️ Qarzdan ${money(value - debt)} ortiq to'lov` : "";
      return propose(
        "customer_payment",
        { order_id: order.id, amount: value, payment_type: type, payment_date: dateOrToday(date), note: note || "" },
        `💵 To'lov: ${await orderTitle(order)}\n${money(value)} · ${type} · ${dateOrToday(date)}${note ? ` · ${note}` : ""}\nQarz: ${money(debt)} → ${money(after)}${over}`,
      );
    },

    async propose_expense({ category, amount, supplier, date, note }) {
      if (!EXPENSE_CATEGORIES.includes(category)) return { xato: "Noma'lum xarajat turi", turlar: EXPENSE_CATEGORIES };
      const value = positive(amount);
      const params = { category, amount: value, date: dateOrToday(date), note: note || "", vendor_id: null, vendor_name: "" };
      if (category === VENDOR_EXPENSE_CATEGORY) {
        if (!supplier) return { xato: "Qaysi ta'minotchiga to'langanini ayting" };
        const { vendor, error } = await oneVendor(supplier);
        if (error) return error;
        const before = await vendorBalance(vendor.id);
        params.vendor_id = vendor.id;
        params.vendor_name = vendor.name;
        return propose(
          "expense",
          params,
          `🏭 ${vendor.name}ga to'lov: ${money(value)} · ${params.date}${note ? ` · ${note}` : ""}\nQarzimiz: ${money(before)} → ${money(before - value)}`,
        );
      }
      return propose("expense", params, `🧾 Xarajat: ${category} — ${money(value)} · ${params.date}${note ? ` · ${note}` : ""}`);
    },

    async propose_supplier_invoice({ supplier, amount, order_number, date, note }) {
      const { vendor, error } = await oneVendor(supplier);
      if (error) return error;
      const value = positive(amount);
      const before = await vendorBalance(vendor.id);
      return propose(
        "supplier_invoice",
        { vendor_id: vendor.id, vendor_name: vendor.name, amount: value, date: dateOrToday(date), order_number: order_number || "", note: note || "" },
        `📄 ${vendor.name} hisob-fakturasi: ${money(value)} · ${dateOrToday(date)}${order_number ? ` · ${order_number}` : ""}${note ? ` · ${note}` : ""}\nQarzimiz: ${money(before)} → ${money(before + value)}`,
      );
    },

    async propose_warehouse_move({ item, direction, quantity, reason, date }) {
      const items = await all("warehouse_items");
      const found = pickOne(items, item, (i) => i.name);
      if (found.length === 0) return { xato: `"${item}" omborda topilmadi`, mavjudlar: items.map((i) => i.name) };
      if (found.length > 1) return { xato: "Bir nechta material mos keldi", variantlar: found.map((i) => i.name) };
      const it = found[0];
      const qty = positive(quantity);
      const current = Number(it.quantity || 0);
      if (direction === "out" && qty > current) return { xato: `Omborda ${current} ${it.unit || ""} bor — ${qty} chiqim qilib bo'lmaydi` };
      const next = direction === "in" ? current + qty : current - qty;
      return propose(
        "warehouse_move",
        { item_id: it.id, item_name: it.name, type: direction, quantity: qty, reason: reason || "", date: dateOrToday(date) },
        `📦 Ombor ${direction === "in" ? "kirim" : "chiqim"}: ${it.name} ${direction === "in" ? "+" : "−"}${qty} ${it.unit || ""}${reason ? ` · ${reason}` : ""}\nQoldiq: ${current} → ${next} ${it.unit || ""}`,
      );
    },
  };
};

// ── Execution (only after an admin taps ✅) ──────────────────────────
const execute = async (db, action, actor) => {
  const p = action.params;
  const now = new Date().toISOString();
  const by = `${actor} (Telegram)`;

  if (action.kind === "order_status") {
    const ref = db.collection("orders").doc(p.order_id);
    const o = (await ref.get()).data();
    if (!o) throw new Error("Buyurtma topilmadi");
    if (p.status === "closed" && Number(o.remaining_amount || 0) > 0) {
      throw new Error(`Buyurtmada ${money(o.remaining_amount)} qarz bor — avval to'lovni kiriting`);
    }
    await ref.update({ status: p.status, completed_at: p.status === "delivered" || p.status === "closed" ? now : null });
    await db.collection("order_status_history").add({
      order_id: p.order_id,
      status: p.status,
      changed_by_email: "telegram-bot",
      changed_by_name: by,
      changed_at: now,
    });
    return "";
  }

  if (action.kind === "customer_payment") {
    const ref = db.collection("orders").doc(p.order_id);
    const o = (await ref.get()).data();
    if (!o) throw new Error("Buyurtma topilmadi");
    await db.collection("order_payments").add({
      order_id: p.order_id,
      amount: p.amount,
      payment_type: p.payment_type,
      payment_date: p.payment_date,
      received_by: by,
      note: p.note,
      created_at: now,
    });
    // Same recalculation as the web app (computeOrderTotals); falls back to
    // the stored total for an order that has no product lines.
    const [prods, pays] = await Promise.all([
      db.collection("order_products").where("order_id", "==", p.order_id).get(),
      db.collection("order_payments").where("order_id", "==", p.order_id).get(),
    ]);
    const subtotal = prods.empty ? Number(o.subtotal || o.total_amount || 0) : prods.docs.reduce((s, d) => s + Number(d.data().total || 0), 0);
    const total = prods.empty ? Number(o.total_amount || 0) : Math.max(0, subtotal - Number(o.discount_amount || 0));
    const paid = pays.docs.reduce((s, d) => s + Number(d.data().amount || 0), 0);
    const remaining = Math.max(0, total - paid);
    await ref.update({ paid_amount: paid, remaining_amount: remaining });
    return `Qolgan qarz: ${money(remaining)}`;
  }

  if (action.kind === "expense") {
    await db.collection("expenses").add({ ...p, created_by: by, created_at: now });
    return "";
  }

  if (action.kind === "supplier_invoice") {
    await db.collection("supplier_invoices").add({ ...p, created_by: by, created_at: now });
    return "";
  }

  if (action.kind === "warehouse_move") {
    const next = await db.runTransaction(async (tx) => {
      const ref = db.collection("warehouse_items").doc(p.item_id);
      const it = (await tx.get(ref)).data();
      if (!it) throw new Error("Material topilmadi");
      const current = Number(it.quantity || 0);
      if (p.type === "out" && p.quantity > current) throw new Error(`Omborda ${current} ${it.unit || ""} bor — ko'p chiqim qilib bo'lmaydi`);
      const qty = p.type === "in" ? current + p.quantity : current - p.quantity;
      tx.update(ref, { quantity: qty });
      tx.set(db.collection("warehouse_transactions").doc(), {
        item_id: p.item_id,
        item_name: p.item_name,
        type: p.type,
        quantity: p.quantity,
        reason: p.reason,
        performed_by: by,
        date: p.date,
        created_at: now,
      });
      return `${qty} ${it.unit || ""}`.trim();
    });
    return `Yangi qoldiq: ${next}`;
  }

  throw new Error(`Noma'lum amal: ${action.kind}`);
};

const sendConfirmations = async (db, telegram, chatId, replyTo, pending) => {
  for (const a of pending) {
    const sent = await telegram("sendMessage", {
      chat_id: chatId,
      text: `${a.summary}\n\nTasdiqlaysizmi?`,
      reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Tasdiqlash", callback_data: `ok:${a.id}` },
          { text: "❌ Bekor", callback_data: `no:${a.id}` },
        ]],
      },
    });
    // Remembered so a confirmation made on the website also updates this
    // Telegram message.
    if (sent && sent.result) {
      await db.collection("bot_actions").doc(a.id).update({ tg_chat_id: chatId, tg_message_id: sent.result.message_id }).catch(() => {});
    }
  }
};

// Anyone who can see a channel can tap its buttons, so every tap is
// checked against the chat's current administrators.
const adminCache = new Map();
const isChatAdmin = async (telegram, chatId, userId) => {
  const hit = adminCache.get(chatId);
  let ids = hit && Date.now() - hit.at < ADMIN_CACHE_MS ? hit.ids : null;
  if (!ids) {
    const res = await telegram("getChatAdministrators", { chat_id: chatId });
    ids = new Set((res.result || []).map((m) => m.user && m.user.id));
    adminCache.set(chatId, { ids, at: Date.now() });
  }
  return ids.has(userId);
};

// Which agent the Hisobchi "walks to" on the AI Ofis page for each action.
const ACTION_VISIT = { order_status: "prod", customer_payment: "fin", expense: "fin", supplier_invoice: "fin", warehouse_move: "wh" };

// One decision path for both the Telegram buttons and the website:
// claims the pending action atomically (a double tap can't run it twice),
// executes it, updates the Telegram message and emits the AI Ofis event.
const decideAction = async (db, telegram, id, ok, actor, extra = {}) => {
  const ref = db.collection("bot_actions").doc(id);
  const claimed = await db.runTransaction(async (tx) => {
    const a = (await tx.get(ref)).data();
    if (!a) return { status: "missing", message: "Topilmadi" };
    if (extra.chatId && a.chat_id !== String(extra.chatId)) return { status: "missing", message: "Topilmadi" };
    if (a.status !== "pending") return { status: a.status, message: "Bu amal allaqachon ko'rib chiqilgan" };
    if (Date.now() - Date.parse(a.created_at) > PENDING_TTL_MS) {
      tx.update(ref, { status: "expired" });
      return { status: "expired", message: "Muddati o'tdi (30 daqiqa) — qaytadan so'rang", action: a };
    }
    tx.update(ref, { status: ok ? "processing" : "cancelled", decided_by: actor, decided_via: extra.via || "telegram", decided_at: new Date().toISOString(), ...(extra.tgUserId ? { decided_by_tg_id: extra.tgUserId } : {}) });
    return { status: ok ? "processing" : "cancelled", action: a };
  });

  const a = claimed.action;
  // The stored message, or — for a tap on an older confirmation — the
  // message whose button was pressed.
  const target = a && a.tg_chat_id && a.tg_message_id ? { chat_id: a.tg_chat_id, message_id: a.tg_message_id } : extra.message;
  const edit = (text) => (target ? telegram("editMessageText", { ...target, text }) : Promise.resolve());
  if (claimed.status === "expired") {
    await edit(`⌛ Muddati o'tdi:\n${a.summary}`);
    return { status: "expired", message: claimed.message };
  }
  if (!a || (claimed.status !== "processing" && claimed.status !== "cancelled")) return { status: claimed.status, message: claimed.message };
  if (claimed.status === "cancelled") {
    await edit(`❌ Bekor qilindi:\n${a.summary}\n— ${actor}`);
    await emitEvent(db, { agent: "bot", kind: "cancelled", text: `Bekor qilindi: ${clip(a.summary, 120)}`, bubble: "Bekor qilindi", source: extra.via || "telegram" });
    return { status: "cancelled", message: "Bekor qilindi" };
  }
  try {
    const result = await execute(db, a, actor);
    await ref.update({ status: "done", result });
    await edit(`✅ Bajarildi:\n${a.summary}${result ? `\n${result}` : ""}\n— ${actor}`);
    await emitEvent(db, {
      agent: "bot",
      kind: "action",
      text: `${clip(a.summary.split("\n")[0], 140)}${result ? ` · ${result}` : ""} — ${actor} tasdiqladi`,
      bubble: "Bajarildi ✅",
      visit: ACTION_VISIT[a.kind] || null,
      detail: a.kind === "warehouse_move" ? { direction: a.params.type, item: a.params.item_name, quantity: a.params.quantity } : { kind: a.kind },
      source: extra.via || "telegram",
    });
    console.log(`Hisobchi action done: ${a.kind} ${id} by ${actor} (${extra.via || "telegram"})`);
    return { status: "done", message: `Bajarildi ✅${result ? ` ${result}` : ""}` };
  } catch (err) {
    await ref.update({ status: "failed", error: err.message });
    await edit(`⚠️ Bajarilmadi:\n${a.summary}\nSabab: ${err.message}`);
    console.error("Hisobchi action failed", id, err);
    return { status: "failed", message: `Bajarilmadi: ${err.message}` };
  }
};

const handleCallback = async (db, telegram, cq, allowedChats) => {
  const answer = (text, alert = false) => telegram("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  const m = /^(ok|no):([A-Za-z0-9]+)$/.exec(cq.data || "");
  if (!m || !chatId || !allowedChats.has(String(chatId))) return answer("Ruxsat yo'q");
  if (!(await isChatAdmin(telegram, chatId, cq.from.id))) return answer("Faqat kanal adminlari tasdiqlay oladi", true);
  const actor = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(" ") || cq.from.username || String(cq.from.id);
  const res = await decideAction(db, telegram, m[2], m[1] === "ok", actor, { chatId, tgUserId: cq.from.id, via: "telegram", message: { chat_id: chatId, message_id: cq.message.message_id } });
  return answer(res.message, !["done", "cancelled"].includes(res.status));
};

module.exports = { ACTION_TOOLS, createActionTools, sendConfirmations, handleCallback, decideAction, findOrders, execute };
