// Eski mijozlarga qo'ng'iroq.
//
// Every working day at 09:00 (Tashkent; not on Sundays or holidays) each
// sales manager — staff linked to a Managerlar record with a Telegram chat,
// limited to RECALL_MANAGERS (names; set in deploy.yml) —
// gets PER_DAY old customers to call, one message each: who, phone, what
// they bought last time and when, all their orders, and what to offer now.
// The longest-silent customers come first; a customer goes to the manager
// who sold to them before when that manager still has room.
//
// Under each customer: ✅ Buyurtma bo'ldi · 🕒 Keyinroq · ❌ Kerak emas ·
// 📵 Javob bermadi. «Keyinroq» asks when, «Kerak emas» asks why. The
// result is written to recall_calls and to the customer's notes in the
// ERP (Mijozlar → Izohlar). A customer comes back: «Javob bermadi» after 3
// days, «Keyinroq» on the chosen day, an unmarked one the next working day
// to the same manager. Not called again for 30 days after a talk, 90 days
// after «Kerak emas», never after «Yopilgan / raqam yo'q».
//
// At 19:00 the admins get the day: each manager's done/total and results,
// orders, and how many old customers are still waiting.
const { telegram } = require("./telegram");
const { todayCode, customerName } = require("./shared");

const PER_DAY = Number(process.env.RECALL_PER_DAY || 5);
const START = process.env.RECALL_START || "2026-11-02";
const SEND_AT = 9 * 60;
const SUMMARY_AT = 19 * 60;
const QUIET_DAYS = 60; // last order at least two months ago
const TALKED_REST = 30;
const NO_REST = 90;
const NOANSWER_BACK = 3;
const TICK_MS = 60 * 1000;
const SITE = process.env.PUBLIC_SITE_URL || "https://printvodiy.uz";
const CLOSED = new Set(["closed", "delivered", "cancelled"]);

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const LATER = { 1: "Ertaga", 3: "3 kundan keyin", 7: "1 haftadan keyin", 30: "1 oydan keyin" };
const NO = { other: "Boshqadan oladi", notnow: "Hozir kerak emas", price: "Narx qimmat", closed: "Yopilgan / raqam yo'q" };
const RESULT = { order: "✅ Buyurtma bo'ldi", later: "🕒 Keyinroq", no: "❌ Kerak emas", noanswer: "📵 Javob bermadi" };

// ── days ──────────────────────────────────────────────────────────────
const dayMs = (day) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day, n) => new Date(dayMs(day) + n * 86400e3).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / 86400e3);
const tashkentMinutes = (now = Date.now()) => {
  const t = new Date(now + 5 * 3600e3);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
const dayLabel = (day) => `${Number(day.slice(8, 10))}-${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const monthYear = (day) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
const ago = (day, today) => {
  const d = daysBetween(day, today);
  if (d < 45) return `${d} kun oldin`;
  return `${Math.round(d / 30.4)} oy oldin`;
};
const mln = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(Math.round(v / 1e5) / 10).toString().replace(".", ",")} mln`;
  return `${Math.round(v / 1000)} ming`;
};

// What to offer this time of year.
const seasonOffer = (today) => {
  const m = Number(today.slice(5, 7));
  if (m >= 10) return "yangi yil — kalendar, Gift Box, bloknot, korporativ sovg'a";
  if (m <= 2) return "8-mart va Navro'z — sovg'a to'plami, paket, futbolka";
  if (m <= 5) return "bitiruv — futbolka, kepka, beydjik, albom";
  if (m <= 8) return "1-sentabr — flayer, buklet, ruchka, bloknot";
  return "yangi yil tayyorgarligi — kalendar, Gift Box";
};

// ── who to call today ─────────────────────────────────────────────────
// Each customer's orders: the last day, the count, the sum, the manager who
// last sold to them and the lines of that last day; and whether an order
// is still open.
const customerStats = (orders, lines) => {
  const linesOf = new Map();
  for (const l of lines) {
    if (!linesOf.has(l.order_id)) linesOf.set(l.order_id, []);
    linesOf.get(l.order_id).push(l);
  }
  const by = new Map();
  for (const o of orders) {
    if (!o.customer_id || o.is_draft || o.status === "cancelled") continue;
    const day = String(o.order_date || o.created_at || "").slice(0, 10);
    if (!day) continue;
    const s = by.get(o.customer_id) || { count: 0, sum: 0, last: "", lastOrders: [], manager_id: null, manager_name: "", open: false };
    s.count++;
    s.sum += Number(o.total_amount || 0);
    if (!CLOSED.has(o.status)) s.open = true;
    if (day > s.last) {
      s.last = day;
      s.lastOrders = [o];
      s.manager_id = o.manager_id || s.manager_id;
      s.manager_name = o.manager_name || s.manager_name;
    } else if (day === s.last) s.lastOrders.push(o);
    by.set(o.customer_id, s);
  }
  for (const s of by.values()) {
    s.lastLines = s.lastOrders.flatMap((o) => linesOf.get(o.id) || []);
    s.lastTotal = s.lastOrders.reduce((t, o) => t + Number(o.total_amount || 0), 0);
  }
  return by;
};

// The newest call per customer and whether it keeps them off today's list
// (resting) or brings them back (due, to that manager).
const callState = (call, today) => {
  if (!call) return { kind: "free" };
  if (call.status === "sent" && call.day < today) return { kind: "due", manager_id: call.manager_id, why: "carry" };
  if (call.status === "sent") return { kind: "rest" };
  if ((call.result === "later" || call.result === "noanswer") && call.next_day) {
    return call.next_day <= today ? { kind: "due", manager_id: call.manager_id, why: call.result } : { kind: "rest" };
  }
  if (call.result === "no") {
    if (call.reason === "closed") return { kind: "rest" };
    return daysBetween(call.day, today) >= NO_REST ? { kind: "free" } : { kind: "rest" };
  }
  return daysBetween(call.day, today) >= TALKED_REST ? { kind: "free" } : { kind: "rest" };
};

// Today's list: { [manager_id]: [{ customer_id, why }] }. Due ones first
// (to their own manager), then the longest-silent customers.
const planDay = ({ customers, stats, calls, managerIds, today, perDay = PER_DAY }) => {
  const latest = new Map();
  for (const c of calls) {
    const cur = latest.get(c.customer_id);
    if (!cur || c.day > cur.day || (c.day === cur.day && String(c.sent_at || "") > String(cur.sent_at || ""))) latest.set(c.customer_id, c);
  }
  const room = new Map(managerIds.map((m) => [m, perDay]));
  const out = Object.fromEntries(managerIds.map((m) => [m, []]));
  const give = (m, item) => {
    out[m].push(item);
    room.set(m, room.get(m) - 1);
  };
  const roomiest = () => [...room.entries()].filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const callable = customers.filter((c) => (c.phone || c.extra_phone) && stats.has(c.id) && !stats.get(c.id).open);
  const due = [];
  const pool = [];
  for (const c of callable) {
    const st = callState(latest.get(c.id), today);
    if (st.kind === "due") due.push({ c, st });
    else if (st.kind === "free" && daysBetween(stats.get(c.id).last, today) >= QUIET_DAYS) pool.push(c);
  }
  const oldest = (a, b) => stats.get(a.id).last.localeCompare(stats.get(b.id).last) || stats.get(b.id).sum - stats.get(a.id).sum;
  due.sort((a, b) => oldest(a.c, b.c));
  for (const { c, st } of due) {
    const m = room.get(st.manager_id) > 0 ? st.manager_id : roomiest();
    if (!m) break;
    give(m, { customer_id: c.id, why: st.why });
  }
  pool.sort(oldest);
  for (const c of pool) {
    const own = stats.get(c.id).manager_id;
    const m = room.get(own) > 0 ? own : roomiest();
    if (!m) break;
    give(m, { customer_id: c.id, why: "old" });
  }
  return { plan: out, waiting: pool.length + due.length - Object.values(out).reduce((t, l) => t + l.length, 0) };
};

// ── messages ──────────────────────────────────────────────────────────
const WHY = { carry: "🔁 kecha belgilanmagan", later: "🕒 qayta qo'ng'iroq kuni", noanswer: "📵 avval javob bermagan" };

const customerText = (c, s, i, n, today, why) => {
  const who = c.company ? `${c.company}${customerName(c) !== c.company ? ` — ${customerName(c)}` : ""}` : customerName(c);
  const phones = [c.phone, c.extra_phone].filter(Boolean).join(", ");
  const items = s.lastLines
    .slice(0, 3)
    .map((l) => `${l.product_name}${l.quantity ? ` ${Number(l.quantity)} dona` : ""}`)
    .join(", ");
  const top = s.lastLines[0] && s.lastLines[0].product_name;
  return [
    `${i}/${n} · ${who}${WHY[why] ? `  (${WHY[why]})` : ""}`,
    `📞 ${phones}`,
    "",
    `Oxirgi xarid: ${ago(s.last, today)}, ${monthYear(s.last)}`,
    `${items || "mahsulot yozilmagan"} — ${mln(s.lastTotal)}`,
    `Jami: ${s.count} buyurtma · ${mln(s.sum)}`,
    "",
    `💡 Taklif: ${seasonOffer(today)}${top ? `; o'tgan safar ${top} — yana kerakmi?` : ""}`,
  ].join("\n");
};

const resultButtons = (id) => ({
  inline_keyboard: [
    [{ text: RESULT.order, callback_data: `rc:o:${id}` }, { text: RESULT.later, callback_data: `rc:l:${id}` }],
    [{ text: RESULT.no, callback_data: `rc:n:${id}` }, { text: RESULT.noanswer, callback_data: `rc:a:${id}` }],
  ],
});
const laterButtons = (id) => ({
  inline_keyboard: [
    [{ text: LATER[1], callback_data: `rc:L:${id}:1` }, { text: LATER[3], callback_data: `rc:L:${id}:3` }],
    [{ text: LATER[7], callback_data: `rc:L:${id}:7` }, { text: LATER[30], callback_data: `rc:L:${id}:30` }],
    [{ text: "↩️ Orqaga", callback_data: `rc:b:${id}` }],
  ],
});
const noButtons = (id) => ({
  inline_keyboard: [
    [{ text: NO.other, callback_data: `rc:N:${id}:other` }, { text: NO.notnow, callback_data: `rc:N:${id}:notnow` }],
    [{ text: NO.price, callback_data: `rc:N:${id}:price` }, { text: NO.closed, callback_data: `rc:N:${id}:closed` }],
    [{ text: "↩️ Orqaga", callback_data: `rc:b:${id}` }],
  ],
});

const hm = (iso) => {
  const t = new Date(Date.parse(iso) + 5 * 3600e3);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
};
const resultLine = (call) => {
  if (call.result === "later") return `${RESULT.later} — ${dayLabel(call.next_day)} kuni qayta chiqadi`;
  if (call.result === "no") return `${RESULT.no} — ${NO[call.reason] || call.reason}`;
  if (call.result === "noanswer") return `${RESULT.noanswer} — ${dayLabel(call.next_day)} kuni qayta chiqadi`;
  return `${RESULT.order}\nERP'da buyurtma: ${SITE}/orders/new?customer=${call.customer_id}`;
};
const noteText = (call) =>
  `☎️ Eski mijozga qo'ng'iroq (${dayLabel(call.day)}): ${call.result === "later" ? `keyinroq — ${dayLabel(call.next_day)}` : call.result === "no" ? `kerak emas — ${NO[call.reason] || call.reason}` : call.result === "noanswer" ? "javob bermadi" : "buyurtma bo'ldi"}`;

const summaryText = (day, rows, totals) => {
  const lines = [`📊 Eski mijozlarga qo'ng'iroq — ${dayLabel(day)}`, ""];
  for (const r of rows) {
    const parts = [`✅ ${r.order}`];
    if (r.later) parts.push(`🕒 ${r.later}`);
    if (r.no) parts.push(`❌ ${r.no}`);
    if (r.noanswer) parts.push(`📵 ${r.noanswer}`);
    lines.push(`${r.name} — ${r.done}/${r.total}${r.done < r.total ? " ⚠️" : ""} · ${parts.join(" · ")}`);
  }
  const done = rows.reduce((t, r) => t + r.done, 0);
  const total = rows.reduce((t, r) => t + r.total, 0);
  const orders = rows.reduce((t, r) => t + r.order, 0);
  lines.push("", `Jami: ${done}/${total} ishlandi · ${orders} ta buyurtma`);
  if (total > done) lines.push(`Belgilanmagan ${total - done} ta ertaga qayta chiqadi.`);
  lines.push("", `${dayLabel(totals.since)}dan beri: ${totals.done} qo'ng'iroq · ${totals.orders} buyurtma · navbatda yana ${totals.waiting} mijoz`);
  return lines.join("\n");
};

// ── the module ────────────────────────────────────────────────────────
const create = (db) => {
  const col = db.collection("recall_calls");
  const days = db.collection("recall_days");
  const all = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  // Sales managers with a Telegram chat: { manager_id, name, chat, email }.
  const managers = async () => {
    const names = new Map((await all("managers")).map((m) => [m.id, m.name]));
    const only = (process.env.RECALL_MANAGERS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const seen = new Set();
    return (await all("staff"))
      .filter((s) => s.report_manager_id && s.telegram_chat_id && s.active !== false && s.is_active !== false)
      .map((s) => ({ manager_id: s.report_manager_id, name: names.get(s.report_manager_id) || s.full_name || s.id, chat: Number(s.telegram_chat_id), email: s.id }))
      .filter((m) => !only.length || only.includes(m.name.toLowerCase()))
      .filter((m) => !seen.has(m.manager_id) && seen.add(m.manager_id));
  };
  const admins = async () =>
    (await db.collection("staff").where("role", "==", "admin").get()).docs
      .map((d) => d.data())
      .filter((s) => s.telegram_chat_id && !s.report_manager_id)
      .map((s) => Number(s.telegram_chat_id));

  const load = async (today) => {
    const [customers, orders, lines, calls] = await Promise.all([all("customers"), all("orders"), all("order_products"), all("recall_calls")]);
    const stats = customerStats(orders, lines);
    return { customers, stats, calls, byId: new Map(customers.map((c) => [c.id, c])), today };
  };

  // Today's messages. `preview` sends them to the given chats instead,
  // marked SINOV, without buttons and without writing anything.
  const sendDay = async (today, preview = null) => {
    const team = await managers();
    if (!team.length) return { sent: 0, note: "no managers" };
    const data = await load(today);
    // Orders name their manager (manager_name); point each customer's last
    // manager at the bot's manager record.
    const idByName = new Map(team.map((m) => [m.name.trim().toLowerCase(), m.manager_id]));
    for (const s of data.stats.values()) s.manager_id = idByName.get(String(s.manager_name || "").trim().toLowerCase()) || s.manager_id;
    const { plan } = planDay({ ...data, managerIds: team.map((m) => m.manager_id), today });
    let sent = 0;
    const counts = {};
    for (const m of team) {
      const list = plan[m.manager_id];
      counts[m.name] = list.length;
      const chats = preview || [m.chat];
      const head = list.length
        ? `☎️ Bugungi eski mijozlar — ${list.length} ta\n${m.name}, bugun shu mijozlarga qo'ng'iroq qiling. Har biridan keyin natijani tugma bilan belgilang.`
        : `☎️ ${m.name}, bugun eski mijozlar ro'yxati bo'sh.`;
      for (const chat of chats) await telegram("sendMessage", { chat_id: chat, text: preview ? `🧪 SINOV · ${m.name}\n\n${head}` : head }).catch(() => undefined);
      for (const [i, item] of list.entries()) {
        const c = data.byId.get(item.customer_id);
        const text = customerText(c, data.stats.get(c.id), i + 1, list.length, today, item.why);
        if (preview) {
          for (const chat of chats) await telegram("sendMessage", { chat_id: chat, text }).catch(() => undefined);
          continue;
        }
        const id = `${today}_${c.id}`;
        const doc = { day: today, customer_id: c.id, customer_name: c.company || customerName(c), manager_id: m.manager_id, manager_name: m.name, staff_email: m.email, chat_id: m.chat, why: item.why, status: "sent", text, sent_at: new Date().toISOString() };
        await col.doc(id).set(doc);
        // A carried or due customer's earlier call is now handled by this one.
        for (const old of data.calls.filter((x) => x.customer_id === c.id && x.status === "sent" && x.day < today)) await col.doc(old.id).update({ status: "carried" });
        const r = await telegram("sendMessage", { chat_id: m.chat, text, reply_markup: resultButtons(id) }).catch(() => null);
        if (r && r.result) await col.doc(id).update({ message_id: r.result.message_id });
        sent++;
      }
    }
    return { sent, counts };
  };

  const sendSummary = async (today) => {
    const team = await managers();
    const calls = await all("recall_calls");
    const todays = calls.filter((c) => c.day === today && c.status !== "carried");
    const rows = team.map((m) => {
      const mine = todays.filter((c) => c.manager_id === m.manager_id);
      const n = (r) => mine.filter((c) => c.result === r).length;
      return { name: m.name, total: mine.length, done: mine.filter((c) => c.status === "done").length, order: n("order"), later: n("later"), no: n("no"), noanswer: n("noanswer") };
    });
    const doneAll = calls.filter((c) => c.status === "done");
    const data = await load(addDays(today, 1));
    const { waiting } = planDay({ ...data, managerIds: [], today: addDays(today, 1) });
    const text = summaryText(today, rows, { since: START, done: doneAll.length, orders: doneAll.filter((c) => c.result === "order").length, waiting });
    for (const chat of await admins()) await telegram("sendMessage", { chat_id: chat, text }).catch(() => undefined);
  };

  const workday = async (day) => new Date(`${day}T00:00:00Z`).getUTCDay() !== 0 && (await db.collection("holidays").where("date", "==", day).get()).empty;

  // Once a day each: the lists after 09:00, the summary after 19:00.
  const once = async (day, field) =>
    db.runTransaction(async (tx) => {
      const ref = days.doc(day);
      const s = await tx.get(ref);
      if (s.exists && s.data()[field]) return false;
      tx.set(ref, { [field]: new Date().toISOString() }, { merge: true });
      return true;
    });
  const tick = async (now = Date.now()) => {
    const today = todayCode();
    if (today < START) return;
    const min = tashkentMinutes(now);
    if (min < SEND_AT) return;
    if (!(await workday(today))) return;
    if (min < SUMMARY_AT) {
      if (await once(today, "sent")) await sendDay(today);
    } else {
      const d = (await days.doc(today).get()).data() || {};
      if (d.sent && (await once(today, "summary"))) await sendSummary(today);
    }
  };

  const handleCallback = async (cq) => {
    const chatId = cq.message && cq.message.chat && cq.message.chat.id;
    const answer = (text) => telegram("answerCallbackQuery", { callback_query_id: cq.id, ...(text ? { text } : {}) });
    const m = (cq.data || "").match(/^rc:([olnaLNb]):([\w-]+)(?::(\w+))?$/);
    if (!m || !chatId) return answer();
    const [, act, id, arg] = m;
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return answer("Topilmadi");
    const call = snap.data();
    if (Number(call.chat_id) !== Number(chatId)) return answer("Bu mijoz boshqa menejerga berilgan");
    const edit = (text, markup) => telegram("editMessageText", { chat_id: chatId, message_id: cq.message.message_id, text, ...(markup ? { reply_markup: markup } : {}) });
    if (act === "l") return Promise.all([answer(), edit(`${call.text}\n\n🕒 Qachon qayta qo'ng'iroq qilay?`, laterButtons(id))]);
    if (act === "n") return Promise.all([answer(), edit(`${call.text}\n\n❌ Sababi?`, noButtons(id))]);
    if (act === "b") return Promise.all([answer(), edit(call.text, resultButtons(id))]);

    const now = new Date().toISOString();
    const done = { status: "done", result_at: now };
    if (act === "o") Object.assign(done, { result: "order" });
    else if (act === "a") Object.assign(done, { result: "noanswer", next_day: addDays(call.day, NOANSWER_BACK) });
    else if (act === "L" && LATER[arg]) Object.assign(done, { result: "later", next_day: addDays(todayCode(), Number(arg)) });
    else if (act === "N" && NO[arg]) Object.assign(done, { result: "no", reason: arg });
    else return answer();
    const next = { ...call, ...done };
    await ref.update(done);
    await db.collection("customer_notes").add({ customer_id: call.customer_id, author_email: call.staff_email || "", author_name: call.manager_name || "", text: noteText(next), created_at: now });
    await answer(RESULT[next.result]);
    await edit(`${call.text}\n\n${resultLine(next)} — ${hm(now)}`);
  };

  let timer = null;
  const start = () => {
    timer = setInterval(() => void tick().catch((err) => console.error("Recall tick failed", err.message)), TICK_MS);
    console.log(`Recall: ${PER_DAY} old customers per manager each working day from ${START}`);
  };
  const stop = () => clearInterval(timer);

  return { start, stop, tick, sendDay, sendSummary, handleCallback, managers, admins };
};

module.exports = { create, planDay, customerStats, callState, customerText, summaryText, seasonOffer, addDays };
