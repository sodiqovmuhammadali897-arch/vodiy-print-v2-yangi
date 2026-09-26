// Shared plumbing for the daily "virtual employee" reports run by
// .github/workflows/daily-report.yml. Each agent builds its own Report
// and sends it as a separate Telegram message.
import { createRequire } from "node:module";

export const env = process.env;
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent, UTC+5, no DST
const DAY_MS = 86400000;

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const money = (n) => `${Math.round(n).toLocaleString("ru-RU").replace(/[\s,  ]/g, " ")} so'm`;
export const plural = (n, word) => `${n} ta ${word}`;

// Tashkent calendar days. Every created_at in Firestore is a UTC ISO
// string, so string range comparison against these bounds is exact;
// date-only fields (deadline, payment_date, due_date) compare directly
// against the day codes.
const nowTashkent = new Date(Date.now() + TZ_OFFSET_MS);
export const todayCode = nowTashkent.toISOString().slice(0, 10);
export const dayCodeOffset = (days) => new Date(nowTashkent.getTime() + days * DAY_MS).toISOString().slice(0, 10);
export const yesterdayCode = dayCodeOffset(-1);
export const tomorrowCode = dayCodeOffset(1);
export const dayStartUtc = (code) => new Date(Date.parse(`${code}T00:00:00Z`) - TZ_OFFSET_MS).toISOString();
export const yStart = dayStartUtc(yesterdayCode);
export const yEnd = dayStartUtc(todayCode);
// Tashkent day code of a UTC ISO timestamp, or of a plain date string.
export const dayCodeOf = (value) => {
  if (!value) return "";
  if (value.length === 10) return value;
  return new Date(Date.parse(value) + TZ_OFFSET_MS).toISOString().slice(0, 10);
};
export const daysBetween = (fromCode, toCode) => Math.round((Date.parse(toCode) - Date.parse(fromCode)) / DAY_MS);
export const hoursSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 3600000);

// Telegram HTML -> plain text for the AI Ofis feed.
const plain = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export class Report {
  // agentId: this report's character on the AI Ofis page (it, sales, fin,
  // prod, wh).
  constructor(title, agentId) {
    this.title = title;
    this.agentId = agentId;
    this.problems = 0;
    this.problemTexts = [];
    this.sections = [];
  }
  ok = (text) => `✅ ${text}`;
  warn = (text) => {
    this.problems += 1;
    this.problemTexts.push(plain(text));
    return `⚠️ ${text}`;
  };
  fail = (text) => {
    this.problems += 1;
    this.problemTexts.push(plain(text));
    return `❌ ${text}`;
  };
  // One failing check becomes a line in the report instead of killing it.
  section = async (title, fn) => {
    try {
      const lines = (await fn()).filter(Boolean);
      if (lines.length > 0) this.sections.push(`<b>${title}</b>\n${lines.join("\n")}`);
    } catch (err) {
      this.sections.push(`<b>${title}</b>\n${this.fail(`tekshirib bo'lmadi: ${esc(err?.message || err)}`)}`);
    }
  };
  text() {
    const summary =
      this.problems === 0 ? "✅ <b>Hammasi joyida</b>" : `⚠️ <b>${this.problems} ta masala e'tibor talab qiladi</b>`;
    return [`<b>${this.title}</b>\n${todayCode}\n\n${summary}`, ...this.sections].join("\n\n");
  }
  // Destination: this agent's topic in the linked work group
  // (telegram_config/main, set up from Sozlamalar → Telegram guruh);
  // before a group is linked, the agent's own channel secret (chatEnv,
  // e.g. TELEGRAM_SALES_CHAT_ID) or the IT channel.
  send = async (chatEnv) => {
    const text = this.text();
    console.log(`${text}\n`);
    const token = env.TELEGRAM_BOT_TOKEN;
    let chatId = (chatEnv && env[chatEnv]) || env.TELEGRAM_IT_CHAT_ID;
    let threadId = null;
    try {
      const cfg = getDb() ? (await getDb().collection("telegram_config").doc("main").get()).data() : null;
      if (cfg?.group_chat_id) {
        chatId = cfg.group_chat_id;
        threadId = cfg.topics?.[this.agentId] || null;
      }
    } catch (err) {
      console.error("telegram_config read failed, using the channel:", err.message);
    }
    if (!token || !chatId) {
      console.log("::warning::TELEGRAM_BOT_TOKEN / chat id not set — report printed above but not sent.");
      return;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...(threadId ? { message_thread_id: threadId } : {}), text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log("Report sent to Telegram.");
    await this.emit();
  };
  // Tells the AI Ofis page this agent posted its report (it animates the
  // agent sending it to the channel and raises a red "!" on problems).
  emit = async () => {
    const d = getDb();
    if (!d || !this.agentId) return;
    const first = this.problemTexts[0] || "";
    const text = this.problems === 0 ? "Kunlik hisobot: hammasi joyida" : `${this.problems} ta masala. ${first}`;
    const now = new Date().toISOString();
    try {
      await d.collection("agent_events").add({
        agent: this.agentId,
        kind: this.problems ? "alert" : "report",
        text: text.slice(0, 220),
        bubble: (this.problems ? first : "Hisobot yuborildi ✅").slice(0, 90),
        source: "schedule",
        created_at: now,
      });
      await d.collection("agent_status").doc(this.agentId).set({ alert: this.problems > 0, summary: text.slice(0, 220), updated_at: now });
    } catch (err) {
      console.error("agent_events write failed:", err.message);
    }
  };
}

// firebase-admin lives in functions/node_modules, so resolve it from there.
let db;
export const getDb = () => {
  if (db !== undefined) return db;
  if (!env.FIREBASE_SERVICE_ACCOUNT) return (db = null);
  const require = createRequire(new URL("../../functions/package.json", import.meta.url));
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  return (db = getFirestore());
};

export const readAll = async (collection) => {
  const snap = await getDb().collection(collection).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const readCreatedYesterday = async (collection) => {
  const snap = await getDb().collection(collection).where("created_at", ">=", yStart).where("created_at", "<", yEnd).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Keeps a long list readable in one Telegram message.
export const bullets = (items, max, render) => {
  const lines = items.slice(0, max).map((x) => `   – ${render(x)}`);
  if (items.length > max) lines.push(`   … yana ${items.length - max} ta`);
  return lines;
};

export const countBy = (items, keyFn) => {
  const map = new Map();
  for (const x of items) {
    const k = keyFn(x);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

export const orderDebt = (o) =>
  Number(o.remaining_amount || 0) || Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));

export const ORDER_STATUS_LABELS = {
  new: "Yangi",
  accepted: "Qabul qilindi",
  calculating: "Hisob-kitob qilinmoqda",
  awaiting_advance: "Avans kutilmoqda",
  design: "Dizaynda",
  approving: "Tasdiqlanmoqda",
  sent_to_production: "Ishlab chiqarishga yuborildi",
  production: "Ishlab chiqarishda",
  quality_control: "Sifat nazoratida",
  ready: "Tayyor",
  ready_to_deliver: "Yetkazishga tayyor",
  delivered: "Yetkazildi",
  closed: "Yopildi",
  cancelled: "Bekor qilindi",
};
export const orderLabel = (o) => esc(o.order_number || o.title || o.id);
