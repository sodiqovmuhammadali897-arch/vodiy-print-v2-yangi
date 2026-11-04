// AI ROP — a sales head's review of recorded calls. A call's recording
// (the link Mois Zvonki puts on the amoCRM call, amo_calls.record) is
// turned into text (OpenAI), then Claude
// scores it against the Darslik call order: Kontakt → Ramka → Ehtiyoj
// (SPIN) → Tavsiya → Narx va muddat → E'tiroz → Yopish → Keyingi qadam,
// and says what was missing and one thing to do better. Results go to
// call_reviews/{callId} (admin-only: the text has the customer's words)
// and a short report to the admins on Telegram. Run by hand for now
// (.github/workflows/call-review.yml → checks/callReviewRun.js).

const STEPS = [
  { key: "kontakt", title: "Kontakt", what: "salom, o'zini va kompaniyani tanishtirdi, mijozni ismi bilan atadi, gaplashishga vaqti borligini so'radi" },
  { key: "ramka", title: "Ramka", what: "suhbat qanday o'tishini aytdi: avval savollar, keyin variant va narx — mijoz rozi bo'ldi" },
  { key: "ehtiyoj", title: "Ehtiyoj (SPIN)", what: "nima uchun, nechta, qachonga, hozir qanday qilayotganini so'radi; mijoz ko'proq gapirdi" },
  { key: "tavsiya", title: "Tavsiya", what: "ehtiyojga mos aniq variant taklif qildi va nega aynan shu ekanini aytdi" },
  { key: "narx", title: "Narx va muddat", what: "narxni tavsiyadan keyin aytdi, tiraj oshsa arzonlashishini, tayyor bo'lish muddatini aytdi" },
  { key: "etiroz", title: "E'tiroz", what: "«qimmat», «o'ylab ko'raman» kabi e'tirozni tinglab, savol bilan aniqlab javob berdi" },
  { key: "yopish", title: "Yopish", what: "buyurtma yoki keyingi qadamni o'zi taklif qildi (maket, hisob, avans)" },
  { key: "keyingi", title: "Keyingi qadam", what: "aniq kelishuv bilan tugatdi: nima, qachon, kim — masalan «ertaga 11:00 da maket yuboraman»" },
];
const MIN_SEC = 90;
const DAY = 86400000;

// Which calls to review, from amoCRM (amo_calls, where each call already
// has its manager and Mois Zvonki's recording link): answered, with a
// recording, 90+ s, from the last `days` days, not reviewed yet; taken in
// turn per manager so each gets some, newest first. Calls with no manager
// only fill what is left.
function pickCalls({ calls, reviewed, n = 10, now = Date.now(), days = 7 }) {
  const from = now - days * DAY;
  const fresh = calls
    .filter((c) => c.record && Number(c.duration || 0) >= MIN_SEC && !reviewed.has(c.id))
    .filter((c) => Date.parse(c.at || "") >= from)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const byManager = new Map();
  for (const c of fresh) {
    const k = c.manager || "";
    if (!byManager.has(k)) byManager.set(k, []);
    byManager.get(k).push(c);
  }
  const queues = [...byManager.entries()].filter(([k]) => k).sort((a, b) => a[0].localeCompare(b[0])).map(([, q]) => q);
  const out = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  for (const c of byManager.get("") || []) if (out.length < n) out.push(c);
  return out;
}

// The tool Claude fills in.
const REVIEW_TOOL = {
  name: "call_review",
  description: "Sotuv qo'ng'irog'ining bahosi",
  input_schema: {
    type: "object",
    properties: {
      sales_call: { type: "boolean", description: "Bu sotuv suhbatimi (mijoz bilan buyurtma/narx haqida)? Ichki yoki texnik gap bo'lsa false." },
      topic: { type: "string", description: "Mijoz nima so'radi — bir gap" },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: STEPS.map((s) => s.key) },
            done: { type: "string", enum: ["ha", "qisman", "yo'q", "kerak emas"] },
            note: { type: "string", description: "qisqa izoh yoki suhbatdan iqtibos" },
          },
          required: ["key", "done", "note"],
        },
      },
      score: { type: "integer", minimum: 0, maximum: 100 },
      talk_share: { type: "string", enum: ["menejer ko'p gapirdi", "teng", "mijoz ko'p gapirdi"] },
      best: { type: "string", description: "Eng yaxshi qilingan narsa — bir gap" },
      missed: { type: "string", description: "Eng muhim yetishmagan narsa — bir gap" },
      advice: { type: "string", description: "Keyingi qo'ng'iroq uchun bitta aniq maslahat, aytiladigan gap bilan" },
      outcome: { type: "string", enum: ["buyurtma kelishildi", "keyingi qadam kelishildi", "aniq kelishuv yo'q", "rad etdi"] },
    },
    required: ["sales_call", "topic", "steps", "score", "talk_share", "best", "missed", "advice", "outcome"],
  },
};

const SYSTEM = [
  "Sen Vodiy Print (Farg'ona, poligrafiya va brendlash: paket, bloknot, futbolka, gift box va h.k.) sotuv bo'limi boshlig'isan (ROP).",
  "Senga menejerning mijoz bilan qo'ng'irog'i matni beriladi (ovozdan avtomatik yozilgan, xatolar bo'lishi mumkin; o'zbek va rus aralash).",
  "Uni kompaniyaning qo'ng'iroq tartibi bo'yicha bahola. Bosqichlar:",
  ...STEPS.map((s, i) => `${i + 1}. ${s.title} — ${s.what}`),
  "Qoidalar: faqat matnda bor narsaga tayan, o'ylab topma. Bosqich vaziyatga to'g'ri kelmasa (masalan e'tiroz bo'lmagan) — «kerak emas».",
  "Ball: 100 — hamma kerakli bosqich to'liq; har tushib qolgan muhim bosqich uchun kamaytir. Qisqa, aniq, o'zbek tilida (lotin) yoz.",
  "Maslahat menejer ertaga ishlata oladigan bitta aniq gap bo'lsin.",
].join("\n");

const mm = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const DONE = { ha: "✅", qisman: "🟡", "yo'q": "❌", "kerak emas": "➖" };

// One call's Telegram lines (no customer name or phone).
function callLine(r, i) {
  const steps = STEPS.map((s) => {
    const st = (r.review.steps || []).find((x) => x.key === s.key);
    return `${DONE[st ? st.done : "yo'q"] || "❌"}${s.title}`;
  }).join(" ");
  return [
    `${i}. ${r.manager || "menejer aniqlanmadi"} · ${r.direction === "out" ? "chiquvchi" : "kiruvchi"} · ${mm(r.duration)} · ${r.review.score}/100`,
    `Mavzu: ${r.review.topic}`,
    steps,
    `👍 ${r.review.best}`,
    `⚠️ ${r.review.missed}`,
    `💡 ${r.review.advice}`,
  ].join("\n");
}

// The admins' report: the average, then each call.
function reportText(results) {
  const ok = results.filter((r) => r.review && r.review.sales_call);
  const avg = ok.length ? Math.round(ok.reduce((s, r) => s + r.review.score, 0) / ok.length) : null;
  const weak = {};
  for (const r of ok) for (const st of r.review.steps || []) if (st.done === "yo'q") weak[st.key] = (weak[st.key] || 0) + 1;
  const top = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${STEPS.find((s) => s.key === k).title} (${n})`);
  const head = [
    `🎧 AI ROP — ${results.length} ta qo'ng'iroq tahlili (sinov)`,
    avg === null ? "Sotuv suhbati topilmadi." : `O'rtacha ball: ${avg}/100 · sotuv suhbati: ${ok.length}/${results.length}`,
    top.length ? `Ko'p tushib qolgan: ${top.join(", ")}` : "",
  ].filter(Boolean);
  const body = ok.map((r, i) => callLine(r, i + 1));
  const skipped = results.filter((r) => !r.review || !r.review.sales_call);
  const tail = skipped.length ? [`➖ ${skipped.length} ta qo'ng'iroq sotuv suhbati emas yoki tahlil qilinmadi.`] : [];
  return [head.join("\n"), ...body, ...tail].join("\n\n");
}

module.exports = { STEPS, REVIEW_TOOL, SYSTEM, MIN_SEC, pickCalls, reportText, callLine };
