// "IT hodim": site, deploys/tests, attendance functions, Mois Zvonki
// calls, the VPS and yesterday's activity.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import tls from "node:tls";
import { Report, env, esc, getDb, money, readCreatedYesterday, yStart, yesterdayCode } from "./lib.mjs";

const SITE = "printvodiy.uz";
const r = new Report("🤖 Vodiy Print — kunlik IT hisobot");
const db = getDb();

// ── Sayt ──────────────────────────────────────────────────────────────
await r.section("🌐 Sayt", async () => {
  const lines = [];
  try {
    // The runner sits far from Uzbekistan; a warm-up request absorbs the
    // one-off DNS + TLS handshake so the timed one reflects page speed.
    await fetch(`https://${SITE}`, { signal: AbortSignal.timeout(15000) }).catch(() => {});
    const started = Date.now();
    const res = await fetch(`https://${SITE}`, { signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - started;
    const line = `${SITE} — ${res.status}, ${ms} ms`;
    lines.push(!res.ok ? r.fail(line) : ms > 3000 ? r.warn(`${line} (sekin)`) : r.ok(line));
  } catch (err) {
    lines.push(r.fail(`${SITE} ochilmadi: ${esc(err.message)}`));
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
  lines.push(days < 7 ? r.fail(sslLine) : days < 20 ? r.warn(sslLine) : r.ok(sslLine));
  return lines;
});

// ── Deploy va testlar ─────────────────────────────────────────────────
await r.section("🚀 Deploy va testlar", async () => {
  const lines = [];
  const testSummary = (() => {
    try {
      const out = readFileSync("/tmp/tests.txt", "utf8").replace(/\x1b\[[0-9;]*m/g, ""); // strip colours
      return out.match(/Tests\s+(.+)/)?.[1]?.trim() || "";
    } catch {
      return "";
    }
  })();
  lines.push(
    env.TESTS_OUTCOME === "success"
      ? r.ok(`Testlar o'tdi (${esc(testSummary)})`)
      : r.fail(`Testlar o'tmadi (${esc(testSummary || "natija yo'q")})`),
  );

  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?created=%3E%3D${yStart}&per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const runs = ((await res.json()).workflow_runs || []).filter((x) => x.status === "completed");
  const failed = runs.filter((x) => x.conclusion !== "success" && x.conclusion !== "cancelled");
  if (runs.length === 0) lines.push("• Oxirgi 24 soatda deploy bo'lmagan");
  else if (failed.length === 0) lines.push(r.ok(`${runs.length} ta deploy, hammasi muvaffaqiyatli`));
  else {
    lines.push(r.fail(`${failed.length} / ${runs.length} ta deploy muvaffaqiyatsiz:`));
    for (const x of failed.slice(0, 5)) lines.push(`   – ${esc(x.display_title)}`);
  }
  return lines;
});

// ── Davomat (Cloud Functions loglari + Firestore) ────────────────────
await r.section("🕘 Davomat", async () => {
  if (!db) return [r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const lines = [];

  writeFileSync("/tmp/sa.json", env.FIREBASE_SERVICE_ACCOUNT);
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
      ? r.fail(`Selfie Telegramga: ${photoOk} ta yuborildi, ${photoFail} ta yuborilmadi`)
      : r.ok(`Selfie Telegramga: ${photoOk} ta yuborildi, xato yo'q`),
  );
  lines.push(otherErrors > 0 ? r.fail(`Davomat funksiyalarida ${otherErrors} ta xato`) : r.ok("Davomat funksiyalarida xato yo'q"));

  const att = await db.collection("attendance").where("dateCode", "==", yesterdayCode).get();
  const rows = att.docs.map((d) => d.data()).filter((x) => x.checkInTime);
  const noCheckout = rows.filter((x) => !x.checkOutTime);
  const late = rows.filter((x) => (x.lateMinutes || 0) > 0);
  lines.push(`• Kecha ishga kelganlar: ${rows.length} kishi, kech qolganlar: ${late.length}`);
  if (noCheckout.length > 0) {
    lines.push(r.warn(`Ishni tugatishni belgilamagan: ${noCheckout.map((x) => esc(x.employeeName || x.employeeId)).join(", ")}`));
  }
  return lines;
});

await r.section("📞 Mois Zvonki", async () => {
  if (!db) return [r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const calls = await readCreatedYesterday("calls");
  const answered = calls.filter((c) => c.answered);
  const withRecording = answered.filter((c) => c.recording_url);
  const lines = [`• Kecha: ${calls.length} ta qo'ng'iroq, ${answered.length} tasi javob berilgan`];
  if (answered.length === 0) lines.push("• Javob berilgan qo'ng'iroq yo'q");
  else if (withRecording.length === 0) lines.push(r.fail(`Yozuv (recording) hech birida kelmadi (0 / ${answered.length})`));
  else if (withRecording.length < answered.length) lines.push(r.warn(`Yozuv ${withRecording.length} / ${answered.length} ta qo'ng'iroqda bor`));
  else lines.push(r.ok(`Yozuv barcha ${answered.length} ta qo'ng'iroqda bor`));
  return lines;
});

await r.section("📊 Kechagi faollik", async () => {
  if (!db) return [r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan")];
  const [orders, leads] = await Promise.all([readCreatedYesterday("orders"), readCreatedYesterday("leads")]);
  const real = orders.filter((o) => o.status !== "cancelled" && !o.is_historical);
  const sum = real.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  return [`• Yangi buyurtmalar: ${real.length} ta, ${money(sum)}`, `• Yangi lidlar: ${leads.length} ta`];
});

// ── Server (VPS) ─────────────────────────────────────────────────────
await r.section("🖥 Server", async () => {
  if (!env.SERVER_OUT) return [r.warn("Serverga ulanib bo'lmadi")];
  const kv = Object.fromEntries(
    env.SERVER_OUT.split("\n")
      .map((l) => l.trim().match(/^([A-Z_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  const lines = [];
  for (const [key, name] of [["SVC_WEBHOOK", "Webhook servisi"], ["SVC_NGINX", "Nginx"]]) {
    lines.push(kv[key] === "active" ? r.ok(`${name} ishlayapti`) : r.fail(`${name}: ${esc(kv[key] || "noma'lum")}`));
  }
  const disk = Number(kv.DISK_USED_PCT);
  const diskLine = `Disk: ${disk}% band, ${esc(kv.DISK_FREE)} bo'sh`;
  lines.push(disk >= 90 ? r.fail(diskLine) : disk >= 80 ? r.warn(diskLine) : r.ok(diskLine));
  const uptime = String(kv.UPTIME || "")
    .replace(/^up\s+/, "")
    .replace(/\bweeks?\b/g, "hafta")
    .replace(/\bdays?\b/g, "kun")
    .replace(/\bhours?\b/g, "soat")
    .replace(/\bminutes?\b/g, "daqiqa");
  lines.push(`• Bo'sh xotira: ${esc(kv.MEM_AVAILABLE_MB)} MB · uzluksiz ishlamoqda: ${esc(uptime)}`);
  const whErrors = Number(kv.WEBHOOK_ERRORS || 0);
  lines.push(whErrors > 0 ? r.warn(`Webhook loglarida ${whErrors} ta xato (24 soat)`) : r.ok("Webhook loglarida xato yo'q"));
  lines.push(`• Webhook 24 soatda: ${esc(kv.CALLS_LOGGED)} ta qo'ng'iroq, ${esc(kv.META_LEADS)} ta Meta lid qabul qildi`);
  return lines;
});

await r.send("TELEGRAM_IT_CHAT_ID");
