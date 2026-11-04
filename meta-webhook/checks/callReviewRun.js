// AI ROP test run: reviews N recorded calls (default 10) and sends the
// report to the admins on Telegram. Run on the server by
// .github/workflows/call-review.yml with the server's .env loaded:
//   node checks/callReviewRun.js 10
// Prints counts and scores only — no names, phones or call text — since
// its output goes to GitHub Actions logs. See ../callReview.js.
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");

const base = path.resolve(__dirname, "..");
// The server's settings, read as plain KEY=VALUE lines (not through a shell).
try {
  for (const line of fs.readFileSync(path.join(base, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
} catch {
  // no .env: rely on the environment
}
const R = require(path.join(base, "callReview"));
const DAY = 86400000;
const N = Math.max(1, Math.min(30, Number(process.argv[2]) || 10));
const DAYS = 7;
const TRANSCRIBE = process.env.CALL_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const MODEL = process.env.CALL_REVIEW_MODEL || process.env.ASSISTANT_MODEL || "claude-sonnet-5";

let ffmpeg = "ffmpeg";
try {
  ffmpeg = require(path.join(base, "node_modules/ffmpeg-static")) || "ffmpeg";
} catch {
  ffmpeg = "ffmpeg";
}
const run = (args) =>
  new Promise((resolve, reject) =>
    execFile(ffmpeg, args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, _o, stderr) => (err ? reject(new Error(`ffmpeg: ${String(stderr).slice(-200)}`)) : resolve())),
  );

// Recording → 16 kHz mono mp3 → text. The newer model first; whisper-1 if
// it is not available on this account.
async function transcribe(url, dir) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`yozuv yuklanmadi: HTTP ${res.status}`);
  const src = path.join(dir, "call.aac");
  fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  const mp3 = path.join(dir, "call.mp3");
  await run(["-hide_banner", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-y", mp3]);
  const prompt = "Vodiy Print, paket, bloknot, futbolka, kepka, gift box, logotip, maket, tiraj, dona, narx, chegirma, avans, buyurtma, Farg'ona. Assalomu alaykum.";
  for (const model of [...new Set([TRANSCRIBE, "whisper-1"])]) {
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "call.mp3");
    fd.append("model", model);
    fd.append("response_format", "json");
    fd.append("prompt", prompt);
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd, signal: AbortSignal.timeout(180000) });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.text) return { text: String(data.text).trim(), model };
    if (model === "whisper-1") throw new Error(`matnga aylantirilmadi: ${(data.error && data.error.message) || r.status}`);
  }
  throw new Error("matnga aylantirilmadi");
}

async function review(call, text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: R.SYSTEM,
      tools: [R.REVIEW_TOOL],
      tool_choice: { type: "tool", name: R.REVIEW_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Qo'ng'iroq: ${call.direction === "out" ? "menejer qo'ng'iroq qildi" : "mijoz qo'ng'iroq qildi"}, ${call.duration_seconds} soniya.\n\nMatn:\n${text.slice(0, 20000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude: ${(data.error && data.error.message) || res.status}`);
  const use = (data.content || []).find((c) => c.type === "tool_use");
  if (!use) throw new Error("Claude baho qaytarmadi");
  return use.input;
}

async function main() {
  if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) throw new Error("OPENAI_API_KEY yoki ANTHROPIC_API_KEY yo'q");
  const admin = require(path.join(base, "node_modules/firebase-admin"));
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(base, "service-account.json"))) });
  const db = admin.firestore();
  const { telegram } = require(path.join(base, "telegram"));
  const now = Date.now();
  const fromIso = new Date(now - DAYS * DAY).toISOString();
  const [callsSnap, amoSnap, doneSnap, staffSnap] = await Promise.all([
    db.collection("calls").where("start_time", ">=", fromIso).get(),
    db.collection("amo_calls").where("at", ">=", new Date(now - (DAYS + 1) * DAY).toISOString()).get(),
    db.collection("call_reviews").get(),
    db.collection("staff").get(),
  ]);
  const calls = callsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const amoCalls = amoSnap.docs.map((d) => d.data());
  const reviewed = new Set(doneSnap.docs.map((d) => d.id));
  const picked = R.pickCalls({ calls, amoCalls, reviewed, n: N, now, days: DAYS });
  console.log(`calls in ${DAYS} days: ${calls.length}, eligible picked: ${picked.length} (managers matched: ${picked.filter((c) => c.who).length})`);

  const results = [];
  for (const c of picked) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rop-"));
    try {
      const t = await transcribe(c.recording_url, dir);
      const rv = await review(c, t.text);
      const doc = {
        call_id: c.id,
        at: c.start_time || c.created_at || null,
        direction: c.direction || null,
        duration: Number(c.duration_seconds || 0),
        manager: (c.who && c.who.manager) || "",
        staff_email: (c.who && c.who.staff_email) || null,
        lead_id: c.lead_id || null,
        customer_id: c.customer_id || null,
        transcript: t.text,
        transcribe_model: t.model,
        model: MODEL,
        review: rv,
        reviewed_at: new Date().toISOString(),
        test: true,
      };
      await db.collection("call_reviews").doc(c.id).set(doc);
      results.push(doc);
      console.log(`reviewed: ${Math.round(doc.duration)} s, ${t.model}, ${t.text.length} chars, sales_call=${rv.sales_call}, score=${rv.score}`);
    } catch (err) {
      console.log(`failed: ${String(err.message || err).slice(0, 160)}`);
      results.push({ manager: (c.who && c.who.manager) || "", direction: c.direction, duration: Number(c.duration_seconds || 0), review: null });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  const ok = results.filter((r) => r.review && r.review.sales_call);
  console.log(`done: ${results.length}, sales calls ${ok.length}, average ${ok.length ? Math.round(ok.reduce((s, r) => s + r.review.score, 0) / ok.length) : "-"}`);
  const admins = staffSnap.docs.map((d) => d.data()).filter((s) => s.role === "admin" && !s.report_manager_id && s.telegram_chat_id && s.active !== false);
  const text = R.reportText(results);
  const parts = [];
  let cur = "";
  for (const block of text.split("\n\n")) {
    if ((cur + "\n\n" + block).length > 3800) {
      parts.push(cur);
      cur = block;
    } else cur = cur ? `${cur}\n\n${block}` : block;
  }
  if (cur) parts.push(cur);
  parts.push("Batafsil (matn bilan) — ERP bazasida call_reviews. Natija sizga ma'qul bo'lsa, buni har kuni avtomatik qilamiz.");
  for (const a of admins) for (const p of parts) await telegram("sendMessage", { chat_id: a.telegram_chat_id, text: p });
  console.log(`report sent to ${admins.length} admin chat(s), ${parts.length} message(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(String(e.message || e).slice(0, 300));
    process.exit(1);
  });
