// Daily "IT hodim" health report, posted to a dedicated Telegram channel.
// Runs from .github/workflows/daily-report.yml. Every check is isolated:
// one failing check shows up as a line in the report instead of killing it.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import tls from "node:tls";

const SITE = "printvodiy.uz";
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent, UTC+5, no DST

const env = process.env;
const problems = [];
const sections = [];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
const ok = (text) => `✅ ${text}`;
const warn = (text) => {
  problems.push(text);
  return `⚠️ ${text}`;
};
const fail = (text) => {
  problems.push(text);
  return `❌ ${text}`;
};

// Tashkent calendar day boundaries for "yesterday", as UTC ISO strings —
// every created_at in Firestore is a UTC ISO string, so string range
// comparison against these is exact.
const nowTashkent = new Date(Date.now() + TZ_OFFSET_MS);
const todayCode = nowTashkent.toISOString().slice(0, 10);
const yesterdayCode = new Date(nowTashkent.getTime() - 86400000).toISOString().slice(0, 10);
const dayStartUtc = (code) => new Date(Date.parse(`${code}T00:00:00Z`) - TZ_OFFSET_MS).toISOString();
const yStart = dayStartUtc(yesterdayCode);
const yEnd = dayStartUtc(todayCode);

const section = async (title, fn) => {
  try {
    const lines = await fn();
    sections.push(`<b>${title}</b>\n${lines.filter(Boolean).join("\n")}`);
  } catch (err) {
    sections.push(`<b>${title}</b>\n${fail(`tekshirib bo'lmadi: ${esc(err?.message || err)}`)}`);
  }
};

// ── Sayt ──────────────────────────────────────────────────────────────
await section("🌐 Sayt", async () => {
  const lines = [];
  const started = Date.now();
  try {
    const res = await fetch(`https://${SITE}`, { signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - started;
    const line = `${SITE} — ${res.status}, ${ms} ms`;
    lines.push(!res.ok ? fail(line) : ms > 3000 ? warn(`${line} (sekin)`) : ok(line));
  } catch (err) {
    lines.push(fail(`${SITE} ochilmadi: ${esc(err.message)}`));
  }
  const validTo = await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: SITE, port: 443, servername: SITE, timeout: 10000 }, () => {
      resolve(socket.getPeerCertificate().valid_to);
      socket.end();
    });
    socket.on("error", reject);
    socket.on("timeout", () => reject(new Error("SSL timeout")));
  });
  const days = Math.floor((Date.parse(validTo) - Date.now()) / 86400000);
  const sslLine = `SSL sertifikat: ${days} kun qoldi`;
  lines.push(days < 7 ? fail(sslLine) : days < 20 ? warn(sslLine) : ok(sslLine));
  return lines;
});

// ── Deploy va testlar ─────────────────────────────────────────────────
await section("🚀 Deploy va testlar", async () => {
  const lines = [];
  const testSummary = (() => {
    try {
      return readFileSync("/tmp/tests.txt", "utf8").match(/Tests\s+(.+)/)?.[1]?.trim() || "";
    } catch {
      return "";
    }
  })();
  lines.push(
    env.TESTS_OUTCOME === "success"
      ? ok(`Testlar o'tdi (${esc(testSummary)})`)
      : fail(`Testlar o'tmadi (${esc(testSummary || "natija yo'q")})`),
  );

  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?created=%3E%3D${yStart}&per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const runs = ((await res.json()).workflow_runs || []).filter((r) => r.status === "completed");
  const failed = runs.filter((r) => r.conclusion !== "success" && r.conclusion !== "cancelled");
  if (runs.length === 0) lines.push("• Oxirgi 24 soatda deploy bo'lmagan");
  else if (failed.length === 0) lines.push(ok(`${runs.length} ta deploy, hammasi muvaffaqiyatli`));
  else {
    lines.push(fail(`${failed.length} / ${runs.length} ta deploy muvaffaqiyatsiz:`));
    for (const r of failed.slice(0, 5)) lines.push(`   – ${esc(r.display_title)}`);
  }
  return lines;
});

// ── Firebase (Cloud Functions loglari + Firestore) ───────────────────
const hasFirebase = !!env.FIREBASE_SERVICE_ACCOUNT;
let db = null;
if (hasFirebase) {
  writeFileSync("/tmp/sa.json", env.FIREBASE_SERVICE_ACCOUNT);
  const require = createRequire(new URL("../functions/package.json", import.meta.url));
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  db = getFirestore();
}

await section("🕘 Davomat", async () => {
  if (!db) return [warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const lines = [];

  execFileSync("gcloud", ["auth", "activate-service-account", "--key-file=/tmp/sa.json", "--quiet"], {
    stdio: "ignore",
  });
  const project = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id;
  const filter =
    'resource.type="cloud_run_revision" AND resource.labels.service_name=("attendancecheckin" OR "attendancecheckout") AND (severity>=ERROR OR jsonPayload.message:"Telegram sendPhoto")';
  const raw = execFileSync(
    "gcloud",
    ["logging", "read", filter, `--project=${project}`, "--freshness=24h", "--limit=1000", "--format=json"],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
  );
  const entries = JSON.parse(raw || "[]");
  const msg = (e) => e.jsonPayload?.message || e.textPayload || "";
  const photoOk = entries.filter((e) => msg(e).includes("Telegram sendPhoto ok")).length;
  const photoFail = entries.filter((e) => /Telegram sendPhoto (failed|threw)/.test(msg(e))).length;
  const otherErrors = entries.filter(
    (e) => (e.severity === "ERROR" || e.severity === "CRITICAL") && !/Telegram sendPhoto/.test(msg(e)),
  ).length;
  lines.push(
    photoFail > 0
      ? fail(`Selfie Telegramga: ${photoOk} ta yuborildi, ${photoFail} ta yuborilmadi`)
      : ok(`Selfie Telegramga: ${photoOk} ta yuborildi, xato yo'q`),
  );
  lines.push(otherErrors > 0 ? fail(`Davomat funksiyalarida ${otherErrors} ta xato`) : ok("Davomat funksiyalarida xato yo'q"));

  const att = await db.collection("attendance").where("dateCode", "==", yesterdayCode).get();
  const rows = att.docs.map((d) => d.data()).filter((r) => r.checkInTime);
  const noCheckout = rows.filter((r) => !r.checkOutTime);
  const late = rows.filter((r) => (r.lateMinutes || 0) > 0);
  lines.push(`• Kecha ishga kelganlar: ${rows.length} kishi, kech qolganlar: ${late.length}`);
  if (noCheckout.length > 0) {
    lines.push(warn(`Ishni tugatishni belgilamagan: ${noCheckout.map((r) => esc(r.employeeName || r.employeeId)).join(", ")}`));
  }
  return lines;
});

await section("📞 Mois Zvonki", async () => {
  if (!db) return [warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const snap = await db.collection("calls").where("created_at", ">=", yStart).where("created_at", "<", yEnd).get();
  const calls = snap.docs.map((d) => d.data());
  const answered = calls.filter((c) => c.answered);
  const withRecording = answered.filter((c) => c.recording_url);
  const lines = [`• Kecha: ${calls.length} ta qo'ng'iroq, ${answered.length} tasi javob berilgan`];
  if (answered.length === 0) lines.push("• Javob berilgan qo'ng'iroq yo'q");
  else if (withRecording.length === 0) lines.push(fail(`Yozuv (recording) hech birida kelmadi (0 / ${answered.length})`));
  else if (withRecording.length < answered.length) lines.push(warn(`Yozuv ${withRecording.length} / ${answered.length} ta qo'ng'iroqda bor`));
  else lines.push(ok(`Yozuv barcha ${answered.length} ta qo'ng'iroqda bor`));
  return lines;
});

await section("📊 Kechagi faollik", async () => {
  if (!db) return [warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const range = (col) => db.collection(col).where("created_at", ">=", yStart).where("created_at", "<", yEnd).get();
  const [orders, leads] = await Promise.all([range("orders"), range("leads")]);
  const real = orders.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled" && !o.is_historical);
  const sum = real.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  return [`• Yangi buyurtmalar: ${real.length} ta, ${money(sum)}`, `• Yangi lidlar: ${leads.size} ta`];
});

// ── Server (VPS) ─────────────────────────────────────────────────────
await section("🖥 Server", async () => {
  if (!env.SERVER_OUT) return [warn("Serverga ulanib bo'lmadi")];
  const kv = Object.fromEntries(
    env.SERVER_OUT.split("\n")
      .map((l) => l.trim().match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  const lines = [];
  for (const [key, name] of [["SVC_WEBHOOK", "Webhook servisi"], ["SVC_NGINX", "Nginx"]]) {
    lines.push(kv[key] === "active" ? ok(`${name} ishlayapti`) : fail(`${name}: ${esc(kv[key] || "noma'lum")}`));
  }
  const disk = Number(kv.DISK_USED_PCT);
  const diskLine = `Disk: ${disk}% band, ${esc(kv.DISK_FREE)} bo'sh`;
  lines.push(disk >= 90 ? fail(diskLine) : disk >= 80 ? warn(diskLine) : ok(diskLine));
  lines.push(`• Bo'sh xotira: ${esc(kv.MEM_AVAILABLE_MB)} MB · ${esc(kv.UPTIME)}`);
  const whErrors = Number(kv.WEBHOOK_ERRORS || 0);
  lines.push(whErrors > 0 ? warn(`Webhook loglarida ${whErrors} ta xato (24 soat)`) : ok("Webhook loglarida xato yo'q"));
  lines.push(`• Webhook 24 soatda: ${esc(kv.CALLS_LOGGED)} ta qo'ng'iroq, ${esc(kv.META_LEADS)} ta Meta lid qabul qildi`);
  return lines;
});

const header = `<b>🤖 Vodiy Print — kunlik IT hisobot</b>\n${todayCode}\n\n${
  problems.length === 0 ? "✅ <b>Hammasi joyida</b>" : `⚠️ <b>${problems.length} ta masala e'tibor talab qiladi</b>`
}`;
const text = [header, ...sections].join("\n\n");
console.log(text);

if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_IT_CHAT_ID) {
  console.log("::warning::TELEGRAM_BOT_TOKEN / TELEGRAM_IT_CHAT_ID not set — report printed above but not sent.");
} else {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_IT_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log("Report sent to Telegram.");
}
