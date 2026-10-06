// Employees' questions in the bot's private chat. Only staff an admin
// ticked in Sozlamalar → Xodimlar (staff.bot_ask) may ask (admins get the
// full Hisobchi there instead — assistant.js), and only about:
//   • product prices (the customer price sheet, no cost) — if they may view
//     Mahsulotlar on the site;
//   • their own tasks, attendance and monthly KPI;
//   • their own sales and plan — if they are linked to a Managerlar record.
// Every tool reads the asker's own records only; the model never sees
// company totals, costs, profit or other people's data, so it cannot leak
// them whatever it is asked.
const { telegram, sendDocument } = require("./telegram");
const { todayCode, dayCodeOf, money, orderDebt, clip, emitEvent, createReader } = require("./shared");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5";
const HISTORY_MS = 30 * 60 * 1000;
const HISTORY_TURNS = 4;
const PER_HOUR = 30;
const DEFAULT_WEIGHTS = { attendance: 20, punctuality: 15, hoursWorked: 10, tasksCompleted: 20 };
const TASK_LABEL = { new: "Yangi", in_progress: "Ishga olindi", done: "Bajarildi" };
const PRIORITY = { high: "🔴 shoshilinch", normal: "", low: "past" };

const toMin = (hm) => {
  const [h, m] = String(hm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// Tashkent minutes of the day (UTC+5, no DST).
const tkMin = (iso) => {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
// Worked minutes of a finished day: the lunch break only comes off for the
// part of it the stay covered (same rule as the site).
const workedOf = (r, sched) => {
  if (!r.checkInTimestamp || !r.checkOutTimestamp) return Number(r.workedMinutes || 0);
  const raw = Math.max(0, (new Date(r.checkOutTimestamp) - new Date(r.checkInTimestamp)) / 60000);
  const sameDay = dayCodeOf(r.checkInTimestamp) === dayCodeOf(r.checkOutTimestamp);
  const out = sameDay ? tkMin(r.checkOutTimestamp) : 24 * 60;
  const overlap = Math.min(sched.breakMinutes, Math.max(0, Math.min(out, toMin(sched.breakEnd)) - Math.max(tkMin(r.checkInTimestamp), toMin(sched.breakStart))));
  return Math.max(0, Math.round(raw - overlap));
};
const monthOf = (month) => (/^\d{4}-\d{2}$/.test(month || "") ? month : todayCode().slice(0, 7));
const round1 = (n) => Math.round(n * 10) / 10;

const TOOL_DEFS = {
  product_price: {
    name: "product_price",
    description:
      "Mahsulotning mijozga aytiladigan narxi: tiraj pog'onalari bo'yicha dona narxi, miqdor berilsa jami summa. format: text — chatga matn (odatiy), pdf yoki png — mijozga yuborish uchun fayl. Mahsulot nomi yoki kodi bo'yicha topadi.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Mahsulot nomi yoki kodi, masalan \"flayer A5\" yoki \"45\"" },
        quantity: { type: "number", description: "So'ralgan miqdor bo'lsa" },
        format: { type: "string", enum: ["text", "pdf", "png"], description: "Aytilmasa text" },
      },
      required: ["product"],
    },
  },
  my_tasks: {
    name: "my_tasks",
    description: "So'rayotgan xodimning vazifalari: unga berilgan ochiq vazifalar (muddati, muhimligi bilan) va u bergan, hali bajarilmaganlar.",
    input_schema: { type: "object", properties: {} },
  },
  my_attendance: {
    name: "my_attendance",
    description: "So'rayotgan xodimning o'z davomati: ish vaqti, oy bo'yicha kelgan kunlar, kechikishlar (qaysi kun, necha daqiqa), ishlagan soatlar, bugungi kelgan/ketgan vaqti.",
    input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM, aytilmasa joriy oy" } } },
  },
  my_kpi: {
    name: "my_kpi",
    description: "So'rayotgan xodimning joriy oy KPI bali: davomat, o'z vaqtida kelish, ishlagan soat va vazifalar bo'yicha ballar.",
    input_schema: { type: "object", properties: {} },
  },
  my_sales: {
    name: "my_sales",
    description: "So'rayotgan menejerning o'z savdosi: davr bo'yicha buyurtmalar soni va summasi, oylik reja va bajarilish foizi, o'z mijozlarining qarzlari.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD, aytilmasa oy boshi" },
        to: { type: "string", description: "YYYY-MM-DD, aytilmasa bugun" },
      },
    },
  },
};

const create = (db, { priceTools }) => {
  const history = new Map(); // chatId -> { at, messages }
  const recent = new Map(); // chatId -> timestamps

  const staffByChat = async (chatId) => {
    const snap = await db.collection("staff").where("telegram_chat_id", "==", Number(chatId)).limit(1).get();
    return snap.empty ? null : { email: snap.docs[0].id, ...snap.docs[0].data() };
  };
  const mayAsk = (s) => s.role === "admin" || s.bot_ask === true;
  const canProducts = (s) => s.role === "admin" || Boolean(s.permissions && s.permissions.products && s.permissions.products.view);
  // Own KPI only with the "KPI va bonus" permission (a manager account
  // needs it even when made admin) — same rule as the site.
  const canKpi = (s) => (s.role === "admin" && !s.report_manager_id) || Boolean(s.permissions && s.permissions.kpi && s.permissions.kpi.view);

  const scheduleOf = async (email) => {
    const col = db.collection("work_schedules");
    const [g, own] = await Promise.all([col.doc("default").get(), col.doc(email).get()]);
    const general = { workStart: "09:00", workEnd: "18:00", breakStart: "13:00", breakEnd: "14:00", breakMinutes: 60, weeklyOffDay: 0, ...(g.exists ? g.data() : {}) };
    const p = own.exists ? own.data() : null;
    return {
      workStart: (p && p.workStart) || general.workStart,
      workEnd: (p && p.workEnd) || general.workEnd,
      breakMinutes: Number(general.breakMinutes) || 0,
      breakStart: general.breakStart || "13:00",
      breakEnd: general.breakEnd || "14:00",
      offDays: p && Array.isArray(p.offDays) ? p.offDays : Array.isArray(general.offDays) ? general.offDays : [Number(general.weeklyOffDay)],
      graceMinutes: general.graceMinutes ?? 5,
    };
  };
  // Working days of `month` up to today (or the whole month if past), by the person's days off.
  const workingDays = (month, offDays) => {
    const today = todayCode();
    const [y, m] = month.split("-").map(Number);
    let n = 0;
    for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d++) {
      const code = `${month}-${String(d).padStart(2, "0")}`;
      if (code > today) break;
      if (!offDays.includes(new Date(`${code}T00:00:00Z`).getUTCDay())) n++;
    }
    return n;
  };
  const monthAttendance = async (email, month) =>
    (await db.collection("attendance").where("employeeId", "==", email).get()).docs
      .map((d) => d.data())
      .filter((r) => String(r.dateCode || "").startsWith(month));

  const toolsFor = (s, ctx) => {
    const email = s.email;
    const t = {
      async my_tasks() {
        const [mine, given] = await Promise.all([
          db.collection("tasks").where("assigned_to_email", "==", email).get(),
          db.collection("tasks").where("assigned_by_email", "==", email).get(),
        ]);
        const today = todayCode();
        const row = (x) => ({
          nomi: x.title,
          holati: TASK_LABEL[x.status] || x.status,
          muddati: x.due_date ? dayCodeOf(x.due_date) : "yo'q",
          kechikkan: Boolean(x.due_date && dayCodeOf(x.due_date) < today),
          muhimligi: PRIORITY[x.priority] || undefined,
          buyurtma: x.order_number || undefined,
          bergan: x.assigned_by_name || undefined,
          kimga: x.assigned_to_name || undefined,
        });
        const open = (snap) => snap.docs.map((d) => d.data()).filter((x) => x.status !== "done");
        const byDue = (a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
        return {
          menga_berilgan_ochiq: open(mine).sort(byDue).slice(0, 25).map(({ assigned_to_name, ...x }) => row(x)),
          men_bergan_bajarilmagan: open(given).filter((x) => String(x.assigned_to_email).toLowerCase() !== email).sort(byDue).slice(0, 15).map(row),
          bu_oy_bajarganlarim: mine.docs.map((d) => d.data()).filter((x) => x.status === "done" && String(x.completed_at || "").startsWith(today.slice(0, 7))).length,
        };
      },
      async my_attendance({ month } = {}) {
        const mon = monthOf(month);
        const [sched, rows] = await Promise.all([scheduleOf(email), monthAttendance(email, mon)]);
        const came = rows.filter((r) => r.checkInTime).sort((a, b) => a.dateCode.localeCompare(b.dateCode));
        const late = came.filter((r) => Number(r.lateMinutes) > 0);
        const days = workingDays(mon, sched.offDays);
        const today = rows.find((r) => r.dateCode === todayCode());
        const WD = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
        return {
          oy: mon,
          ish_vaqti: `${sched.workStart}–${sched.workEnd}`,
          dam_olish: sched.offDays.map((d) => WD[d]).join(", ") || "yo'q",
          kechikishga_ruxsat_daqiqa: sched.graceMinutes,
          ish_kunlari_shu_kungacha: days,
          kelgan_kunlar: came.length,
          kelmagan_kunlar: Math.max(0, days - came.length),
          kech_qolgan_kunlar: late.length,
          jami_kechikish_daqiqa: late.reduce((a, r) => a + Number(r.lateMinutes || 0), 0),
          kechikishlar: late.slice(-10).map((r) => `${r.dateCode}: ${r.lateMinutes} daqiqa (${r.checkInTime})`),
          ishlagan_soat: round1(came.reduce((a, r) => a + workedOf(r, sched), 0) / 60),
          bugun: today ? { keldi: today.checkInTime || null, ketdi: today.checkOutTime || null } : "bugun hali belgilanmagan",
        };
      },
      async my_kpi() {
        const mon = todayCode().slice(0, 7);
        const [sched, rows, settings, tasks] = await Promise.all([
          scheduleOf(email),
          monthAttendance(email, mon),
          db.collection("kpi_settings").doc("default").get(),
          db.collection("tasks").where("assigned_to_email", "==", email).get(),
        ]);
        const w = { ...DEFAULT_WEIGHTS, ...((settings.exists && settings.data().weights) || {}) };
        const days = workingDays(mon, sched.offDays);
        const present = rows.filter((r) => r.checkInTime);
        const onTime = present.filter((r) => !(Number(r.lateMinutes) > 0)).length;
        const worked = present.reduce((a, r) => a + workedOf(r, sched), 0);
        const daily = Math.max(0, toMin(sched.workEnd) - toMin(sched.workStart) - sched.breakMinutes);
        const monthTasks = tasks.docs.map((d) => d.data()).filter((x) => String(x.created_at || "").startsWith(mon));
        const done = monthTasks.filter((x) => x.status === "done").length;
        const att = days > 0 ? (present.length / days) * w.attendance : 0;
        const punct = present.length > 0 ? (onTime / present.length) * w.punctuality : 0;
        const hours = days * daily > 0 ? Math.min(1, worked / (days * daily)) * w.hoursWorked : 0;
        const tsk = monthTasks.length ? (done / monthTasks.length) * w.tasksCompleted : 0;
        const max = w.attendance + w.punctuality + w.hoursWorked + (monthTasks.length ? w.tasksCompleted : 0);
        return {
          oy: mon,
          ball: `${round1(att + punct + hours + tsk)} / ${max}`,
          davomat: `${round1(att)} / ${w.attendance} (${present.length} kun keldi, ${days} ish kunidan)`,
          vaqtida_kelish: `${round1(punct)} / ${w.punctuality} (${onTime} kun vaqtida)`,
          ishlagan_soat: `${round1(hours)} / ${w.hoursWorked} (${round1(worked / 60)} soat, kerak ${round1((days * daily) / 60)})`,
          vazifalar: monthTasks.length ? `${round1(tsk)} / ${w.tasksCompleted} (${done} / ${monthTasks.length} bajarildi)` : "bu oy vazifa berilmagan — hisobga olinmaydi",
        };
      },
    };
    if (!canKpi(s)) delete t.my_kpi;
    if (canProducts(s)) {
      const price = priceTools(ctx).product_price_sheet;
      t.product_price = ({ product, quantity, format = "text" }) => price({ product, quantity, format });
    }
    if (s.report_manager_id) {
      t.my_sales = async ({ from, to } = {}) => {
        const today = todayCode();
        const f = /^\d{4}-\d{2}-\d{2}$/.test(from || "") ? from : `${today.slice(0, 7)}-01`;
        const tt = /^\d{4}-\d{2}-\d{2}$/.test(to || "") ? to : today;
        const mgr = await db.collection("managers").doc(s.report_manager_id).get();
        if (!mgr.exists) return { xato: "Menejer profilingiz topilmadi — adminga murojaat qiling" };
        const m = mgr.data();
        const name = String(m.name || "").trim().toLowerCase();
        const all = createReader(db);
        const mine = (await all("orders")).filter((o) => o.status !== "cancelled" && !o.is_draft && String(o.manager_name || "").trim().toLowerCase() === name);
        const inRange = mine.filter((o) => {
          const d = dayCodeOf(o.order_date || o.created_at);
          return d >= f && d <= tt;
        });
        const monthStart = `${today.slice(0, 7)}-01`;
        const monthRevenue = mine.filter((o) => dayCodeOf(o.created_at) >= monthStart).reduce((a, o) => a + Number(o.total_amount || 0), 0);
        const plan = Number(m.monthly_plan) || 0;
        const debts = mine.map((o) => ({ o, d: orderDebt(o) })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d);
        return {
          menejer: m.name,
          davr: `${f} — ${tt}`,
          buyurtmalar: inRange.length,
          summa: money(inRange.reduce((a, o) => a + Number(o.total_amount || 0), 0)),
          oylik_reja: plan ? money(plan) : "belgilanmagan",
          bu_oy_sotuv: money(monthRevenue),
          bajarildi_foiz: plan ? `${Math.round((monthRevenue / plan) * 100)}%` : undefined,
          qarzdorlik_jami: money(debts.reduce((a, x) => a + x.d, 0)),
          qarzdorlar: debts.slice(0, 10).map(({ o, d }) => `${o.order_number || ""} ${o.customer_name || o.title || ""}: ${money(d)}`.trim()),
        };
      };
    }
    return t;
  };

  const systemPrompt = (s, names) =>
    [
      `Sen — Vodiy Print (poligrafiya kompaniyasi) botining xodimlar uchun yordamchisisan. Hozir ${s.full_name || s.email} bilan shaxsiy chatda gaplashyapsan.`,
      `Bugun: ${todayCode()} (Toshkent vaqti).`,
      "Faqat quyidagi mavzularda, faqat vositalar (tools) qaytargan ma'lumot bilan javob berasan:",
      names.includes("product_price") ? "• mahsulot narxlari (mijozga aytiladigan narx, tiraj bo'yicha)" : "",
      names.includes("my_kpi") ? "• xodimning o'z vazifalari, o'z davomati, o'z KPI bali" : "• xodimning o'z vazifalari va o'z davomati (KPI bali so'ralsa: bu botda ko'rsatilmaydi, adminga murojaat qilsin)",
      names.includes("my_sales") ? "• xodimning o'z savdosi, oylik rejasi va o'z mijozlari qarzi" : "",
      "Qoidalar:",
      "- Raqamni o'ylab topma, faqat vositadan ol. Vosita topa olmasa, shuni ayt.",
      "- Boshqa mavzular (kompaniya daromadi, foyda, xarajat, tannarx, maosh, boshqa xodimlar yoki boshqa menejerlar haqida) so'ralsa: bu ma'lumot botda yo'qligini bir gap bilan ayt va admin/rahbarga murojaat qilishni maslahat ber. Hech qanday taxmin qilma.",
      "- Sen hech narsani o'zgartira olmaysan (vazifa, to'lov, buyurtma). Bunday so'rov bo'lsa, saytda qilishni ayt. Vazifani bajarildi qilish — vazifa xabaridagi ✅ tugmasi.",
      "- Narx so'ralsa product_price ni format=text bilan chaqir va qaytgan matnni o'zgartirmay ber; mijozga yuborish uchun PDF yoki rasm so'ralsa format=pdf/png (fayl o'zi yuboriladi, javobda bir qisqa gap yoz).",
      "- Javob o'zbek tilida (lotin), qisqa: avval asosiy javob, keyin kerak bo'lsa 3–8 qator. Telegram oddiy matn: Markdown ishlatma, ro'yxat uchun \"•\".",
    ]
      .filter(Boolean)
      .join("\n");

  const callClaude = async (system, tools, messages) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, tools, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(data && data.error && data.error.message) || JSON.stringify(data)}`);
    return data;
  };

  const answer = async (s, chatId, question, ctx) => {
    const tools = toolsFor(s, ctx);
    const names = Object.keys(tools);
    const defs = names.map((n) => TOOL_DEFS[n]);
    const h = history.get(chatId);
    const past = h && Date.now() - h.at < HISTORY_MS ? h.messages : [];
    const messages = [...past, { role: "user", content: question }];
    const system = systemPrompt(s, names);
    for (let step = 0; step < 5; step++) {
      const reply = await callClaude(system, defs, messages);
      if (reply.stop_reason !== "tool_use") {
        const text = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        // Remember only the plain question/answer pairs for follow-ups.
        const kept = [...past, { role: "user", content: question }, { role: "assistant", content: text || "…" }].slice(-HISTORY_TURNS * 2);
        history.set(chatId, { at: Date.now(), messages: kept });
        return text;
      }
      messages.push({ role: "assistant", content: reply.content });
      const results = [];
      for (const block of reply.content.filter((b) => b.type === "tool_use")) {
        ctx.toolsUsed.push(block.name);
        let out;
        try {
          out = tools[block.name] ? await tools[block.name](block.input || {}) : { xato: "Bu ma'lumot sizga ochiq emas" };
        } catch (err) {
          out = { xato: err.message };
        }
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      }
      messages.push({ role: "user", content: results });
    }
    return "Savol murakkab bo'lib ketdi — iltimos, aniqroq so'rang.";
  };

  const tooFast = (chatId) => {
    const now = Date.now();
    const list = (recent.get(chatId) || []).filter((t) => now - t < 3600 * 1000);
    list.push(now);
    recent.set(chatId, list);
    return list.length > PER_HOUR;
  };

  // true when the message was from a linked employee (answered or refused);
  // false lets the HR agent reply as before.
  const handlePrivateMessage = async (msg) => {
    const text = String(msg.text || "").trim();
    if (!text || text.startsWith("/")) return false;
    const chatId = msg.chat.id;
    const s = await staffByChat(chatId);
    if (!s) return false;
    const reply = (t) => telegram("sendMessage", { chat_id: chatId, text: t, reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } });
    if (!mayAsk(s)) {
      await reply("Botdan savol so'rash uchun admin ruxsat berishi kerak (Sozlamalar → Xodimlar). Vazifa va davomat xabarlari esa odatdagidek kelaveradi.");
      return true;
    }
    if (!ANTHROPIC_API_KEY) {
      await reply("Savol-javob hozir o'chirilgan.");
      return true;
    }
    if (tooFast(chatId)) {
      await reply("Bir soatda juda ko'p savol bo'ldi — birozdan keyin yozing.");
      return true;
    }
    await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
    const ctx = { chatId, text, pending: [], toolsUsed: [], files: [] };
    try {
      const out = (await answer(s, chatId, text, ctx)) || "Javob topilmadi.";
      await reply(out.slice(0, 4000));
      for (const f of ctx.files) await sendDocument({ chatId, buffer: f.buffer, filename: f.filename, caption: f.caption, replyTo: msg.message_id });
      await emitEvent(db, { agent: "bot", kind: "answer", text: clip(`${s.full_name || s.email}: ${text}`, 200), bubble: clip(text, 90), source: "staff" });
      console.log(`Staff bot answered ${s.email}: ${text.slice(0, 80)} [${ctx.toolsUsed.join(",")}]`);
    } catch (err) {
      console.error("Staff bot failed", err);
      await reply("Kechirasiz, hozir javob bera olmadim. Birozdan keyin qayta urinib ko'ring.");
    }
    return true;
  };

  return { handlePrivateMessage, _test: { toolsFor, mayAsk, canKpi, workingDays, systemPrompt } };
};

module.exports = { create, TOOL_DEFS };
