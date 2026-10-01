// Marketolog: video tahlili. A video dropped into the bot (admin's private
// chat or the 📣 Marketing topic) or uploaded on the site's Kontent page
// is cut into frames with ffmpeg; Claude looks at the frames and returns a
// score, what to fix, and ready post texts. Results are kept in
// content_analyses/{id} for the Kontent page. Only the picture is judged —
// the sound is not.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const crypto = require("crypto");
const { telegram: tgDefault, BOT_TOKEN } = require("./telegram");
const { staffFromRequest } = require("./auth");
const { emitEvent } = require("./shared");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.CONTENT_MODEL || process.env.ASSISTANT_MODEL || "claude-sonnet-5";
const TG_MAX = 20 * 1024 * 1024; // Telegram bots can download up to 20 MB
const UPLOAD_MAX = 500 * 1024 * 1024;
const FRAME_TIMES_EARLY = [0, 1, 2, 3]; // the hook decides most views

let ffmpegPath = null;
try {
  ffmpegPath = require("ffmpeg-static");
} catch {
  ffmpegPath = "ffmpeg";
}

const run = (args) =>
  new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 20 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
      // `ffmpeg -i` with no output exits 1 but prints what we need.
      if (err && !String(stderr).includes("Duration")) return reject(new Error(`ffmpeg: ${String(stderr).slice(-300) || err.message}`));
      resolve(String(stderr));
    });
  });

// Duration and size of the video from ffmpeg's banner.
const probe = async (file) => {
  const out = await run(["-hide_banner", "-i", file]);
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  const v = /Video: [^\n]*?(\d{2,5})x(\d{2,5})/.exec(out);
  const rot = /rotate\s*:\s*(-?\d+)|rotation of (-?[\d.]+)/.exec(out);
  let width = v ? Number(v[1]) : null;
  let height = v ? Number(v[2]) : null;
  if (rot && Math.abs(Number(rot[1] || rot[2])) % 180 === 90) [width, height] = [height, width];
  return { duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null, width, height, audio: /Audio:/.test(out) };
};

// The first seconds closely, then the rest evenly: about 10 frames.
const frameTimes = (duration) => {
  const dur = Math.max(0.5, duration || 1);
  const times = FRAME_TIMES_EARLY.filter((t) => t < dur - 0.1);
  const rest = 6;
  for (let i = 1; i <= rest; i++) times.push(Math.min(dur - 0.2, 3 + ((dur - 3) * i) / (rest + 1)));
  return [...new Set(times.map((t) => Math.max(0, Math.round(t * 10) / 10)))].filter((t) => t >= 0).sort((a, b) => a - b).slice(0, 10);
};

const extractFrames = async (file, times, dir) => {
  const frames = [];
  for (const t of times) {
    const out = path.join(dir, `f${String(t).replace(".", "_")}.jpg`);
    await run(["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=-2:640", "-q:v", "5", "-y", out]).catch(() => undefined);
    if (fs.existsSync(out)) {
      const big = fs.readFileSync(out);
      const thumbPath = path.join(dir, `t${String(t).replace(".", "_")}.jpg`);
      await run(["-hide_banner", "-loglevel", "error", "-i", out, "-vf", "scale=-2:200", "-q:v", "7", "-y", thumbPath]).catch(() => undefined);
      frames.push({ t, image: big.toString("base64"), thumb: fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath).toString("base64") : null });
    }
  }
  return frames;
};

const RESULT_TOOL = {
  name: "video_tahlili",
  description: "Videoning marketing tahlili natijasi.",
  input_schema: {
    type: "object",
    properties: {
      umumiy_baho: { type: "number", description: "0–10" },
      qisqa_xulosa: { type: "string", description: "1–2 gap: video nimani ko'rsatadi va asosiy kuchli/zaif tomoni" },
      baholar: {
        type: "object",
        properties: {
          boshlanish: { type: "object", properties: { ball: { type: "number" }, izoh: { type: "string" } }, required: ["ball", "izoh"] },
          ekrandagi_matn: { type: "object", properties: { ball: { type: "number" }, izoh: { type: "string" } }, required: ["ball", "izoh"] },
          brend: { type: "object", properties: { ball: { type: "number" }, izoh: { type: "string" } }, required: ["ball", "izoh"] },
          sifat: { type: "object", properties: { ball: { type: "number" }, izoh: { type: "string" } }, required: ["ball", "izoh"] },
          taklif: { type: "object", properties: { ball: { type: "number" }, izoh: { type: "string" } }, required: ["ball", "izoh"] },
        },
        required: ["boshlanish", "ekrandagi_matn", "brend", "sifat", "taklif"],
      },
      tavsiyalar: { type: "array", items: { type: "string" }, description: "3–5 ta aniq tavsiya, soniyasi bilan (masalan: '0:04 dagi kadrni boshiga qo'ying')" },
      matnlar: {
        type: "array",
        description: "3 ta post matni: har xil uslubda",
        items: { type: "object", properties: { uslub: { type: "string" }, matn: { type: "string" }, heshteglar: { type: "string" } }, required: ["uslub", "matn", "heshteglar"] },
      },
      qayerga: { type: "string", description: "Qaysi format mos: Reels, Stories, lenta, Telegram kanal — va nega" },
      vaqt: { type: "string", description: "Joylash uchun tavsiya qilingan kun/vaqt va sababi" },
      reklamaga_mos: { type: "boolean" },
    },
    required: ["umumiy_baho", "qisqa_xulosa", "baholar", "tavsiyalar", "matnlar", "qayerga", "vaqt", "reklamaga_mos"],
  },
};

const fmtTime = (t) => `0:${String(Math.floor(t)).padStart(2, "0")}`;

const create = (db, { telegram = tgDefault, callClaude = null, staffFrom = staffFromRequest, log = console } = {}) => {
  const claude =
    callClaude ||
    (async (body) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data?.error?.message || "xato"}`);
      return data;
    });

  // What the company sells, so texts name real products.
  const catalogHint = async () => {
    try {
      const snap = await db.collection("products").get();
      return snap.docs
        .map((d) => d.data())
        .filter((p) => p.is_active !== false && !p.archived_at)
        .map((p) => p.name)
        .slice(0, 40)
        .join(", ");
    } catch {
      return "";
    }
  };

  const analyzeFile = async (file, meta) => {
    const info = await probe(file);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vid-"));
    try {
      const frames = await extractFrames(file, frameTimes(info.duration), dir);
      if (!frames.length) throw new Error("Videodan kadr olib bo'lmadi");
      const ratio = info.width && info.height ? (info.height / info.width).toFixed(2) : "?";
      const system = [
        "Sen Vodiy Print (Namangan va Farg'ona; poligrafiya, paket, gift box, suvenir, textil brendlash) kompaniyasining tajribali SMM-marketologisan.",
        "Senga videodan olingan kadrlar vaqti bilan beriladi (ovozi yo'q — ovozni baholama). Instagram Reels/Stories, lenta va Telegram kanal uchun tahlil qil.",
        "Baholashda: birinchi 3 soniya (odamlar shu vaqtda o'tib ketadi), ekrandagi matn o'qilishi, mahsulot va logotip ko'rinishi, tasvir sifati/yorug'lik, aniq taklif (narx, muddat, chaqiriq).",
        "Tavsiyalar aniq bo'lsin: qaysi soniyadagi kadr, nimani qo'shish/olib tashlash. Matnlar o'zbek tilida (lotin), tabiiy, emoji me'yorida, oxirida Direct'ga yozishga chaqiriq.",
        "Raqam yoki narxni o'ylab topma: video yoki izohda bo'lmasa, '…dan boshlab' kabi bo'sh joy qoldir.",
      ].join("\n");
      const products = await catalogHint();
      const content = [
        {
          type: "text",
          text: [
            `Fayl: ${meta.file_name || "video"} · uzunligi ${info.duration ? info.duration.toFixed(1) : "?"} s · ${info.width || "?"}×${info.height || "?"} (bo'yi/eni ${ratio}) · ovoz: ${info.audio ? "bor" : "yo'q"}`,
            meta.note ? `Yuboruvchining izohi: ${meta.note}` : "",
            products ? `Kompaniya mahsulotlari: ${products}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ];
      for (const f of frames) {
        content.push({ type: "text", text: `Kadr ${fmtTime(f.t)}:` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.image } });
      }
      const data = await claude({ model: MODEL, max_tokens: 4000, system, messages: [{ role: "user", content }], tools: [RESULT_TOOL], tool_choice: { type: "tool", name: RESULT_TOOL.name } });
      const result = (data.content || []).find((c) => c.type === "tool_use")?.input;
      if (!result) throw new Error("Tahlil natijasi kelmadi");
      return { info, frames: frames.map((f) => ({ t: f.t, thumb: f.thumb })), result };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  // One analysis end to end: Firestore doc processing → done / failed.
  const analyze = async (file, meta) => {
    const ref = meta.id ? db.collection("content_analyses").doc(meta.id) : db.collection("content_analyses").doc();
    const base = { source: meta.source, by: meta.by || "", by_email: meta.by_email || "", file_name: meta.file_name || "video", size: meta.size || null, note: meta.note || "", created_at: new Date().toISOString() };
    await ref.set({ ...base, status: "processing" });
    try {
      const { info, frames, result } = await analyzeFile(file, meta);
      await ref.set({ ...base, status: "done", duration: info.duration, width: info.width, height: info.height, frames, result, done_at: new Date().toISOString() });
      await emitEvent(db, { agent: "mkt", kind: "report", text: `Video tahlili: ${base.file_name} — ${result.umumiy_baho}/10`, bubble: `Videoni ko'rdim: ${result.umumiy_baho}/10 🎬`, source: "content" });
      return { id: ref.id, info, result };
    } catch (err) {
      await ref.set({ ...base, status: "failed", error: String(err.message || err).slice(0, 300) });
      throw err;
    }
  };

  // Telegram plain-text answer.
  const formatResult = ({ info, result }) => {
    const b = result.baholar || {};
    const line = (name, x) => (x ? `• ${name}: ${x.ball}/10 — ${x.izoh}` : "");
    const parts = [
      `🎬 Video tahlili — ${result.umumiy_baho}/10${info.duration ? ` · ${info.duration.toFixed(0)} s` : ""}${info.width ? ` · ${info.width}×${info.height}` : ""}`,
      result.qisqa_xulosa,
      "",
      line("Boshlanish (0–3 s)", b.boshlanish),
      line("Ekrandagi matn", b.ekrandagi_matn),
      line("Brend va logotip", b.brend),
      line("Sifat", b.sifat),
      line("Taklif", b.taklif),
      "",
      "💡 Tavsiyalar:",
      ...(result.tavsiyalar || []).map((t) => `• ${t}`),
      "",
      `📍 ${result.qayerga}`,
      `🕐 ${result.vaqt}`,
      result.reklamaga_mos ? "🎯 Reklamaga ham mos." : "",
      "",
      "ℹ️ Ovoz tahlil qilinmadi, faqat tasvir.",
    ];
    return parts.filter((p, i, a) => p !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
  };

  // ── Telegram: a video in the admin's private chat or the Marketing topic
  const handleTelegramVideo = async (msg, who) => {
    const v = msg.video || msg.video_note || (msg.document && /^video\//.test(msg.document.mime_type || "") ? msg.document : null);
    if (!v) return false;
    const chat = { chat_id: msg.chat.id, ...(msg.is_topic_message ? { message_thread_id: msg.message_thread_id } : {}) };
    const reply = (text, extra = {}) => telegram("sendMessage", { ...chat, text, reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true }, link_preview_options: { is_disabled: true }, ...extra });
    if (!ANTHROPIC_API_KEY && !callClaude) {
      await reply("Video tahlili uchun AI kaliti sozlanmagan.");
      return true;
    }
    if (v.file_size && v.file_size > TG_MAX) {
      await reply(`Video ${Math.round(v.file_size / 1048576)} MB — bot 20 MB gacha qabul qiladi. Saytdagi Kontent bo'limidan yuklang (500 MB gacha): https://printvodiy.uz/content`);
      return true;
    }
    await reply("⏳ Videoni ko'ryapman — 1–2 daqiqa…");
    const typing = setInterval(() => telegram("sendChatAction", { chat_id: msg.chat.id, action: "typing" }).catch(() => undefined), 4500);
    const tmp = path.join(os.tmpdir(), `tg-${crypto.randomBytes(6).toString("hex")}.mp4`);
    try {
      const f = await telegram("getFile", { file_id: v.file_id });
      if (!f.ok) throw new Error(f.description || "Telegram fayl berilmadi");
      const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${f.result.file_path}`, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`Faylni yuklab bo'lmadi (${res.status})`);
      fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
      const out = await analyze(tmp, { source: "telegram", by: who || [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" "), file_name: v.file_name || "telegram-video.mp4", size: v.file_size, note: msg.caption || "" });
      await reply(formatResult(out));
      for (const [i, m] of (out.result.matnlar || []).entries()) {
        await reply(`✍️ ${i + 1}-variant · ${m.uslub}\n\n${m.matn}\n\n${m.heshteglar}`);
      }
    } catch (err) {
      log.error("Video analysis failed", err);
      await reply(`Videoni tahlil qilib bo'lmadi: ${err.message}`);
    } finally {
      clearInterval(typing);
      fs.rmSync(tmp, { force: true });
    }
    return true;
  };

  // ── Site upload: raw body (the file) with the Firebase token ────────
  const register = (app) => {
    app.post("/webhooks/content/analyze", async (req, res) => {
      const who = await staffFrom(db, req);
      const allowed = who && (who.role === "admin" || Boolean(who.staff?.permissions?.ads?.view));
      if (!allowed) return res.status(403).json({ error: "Ruxsat yo'q" });
      const size = Number(req.get("content-length") || 0);
      if (!size) return res.status(400).json({ error: "Fayl yo'q" });
      if (size > UPLOAD_MAX) return res.status(413).json({ error: "500 MB dan katta" });
      const name = decodeURIComponent(req.get("x-file-name") || "video.mp4").slice(0, 120);
      const note = decodeURIComponent(req.get("x-note") || "").slice(0, 500);
      const tmp = path.join(os.tmpdir(), `up-${crypto.randomBytes(6).toString("hex")}${path.extname(name) || ".mp4"}`);
      const out = fs.createWriteStream(tmp);
      let got = 0;
      let failed = false;
      req.on("data", (chunk) => {
        got += chunk.length;
        if (got > UPLOAD_MAX && !failed) {
          failed = true;
          req.destroy();
        }
      });
      req.pipe(out);
      out.on("finish", async () => {
        if (failed) {
          fs.rmSync(tmp, { force: true });
          return;
        }
        const ref = db.collection("content_analyses").doc();
        res.status(202).json({ id: ref.id });
        analyze(tmp, { id: ref.id, source: "site", by: who.name, by_email: who.email, file_name: name, size: got, note })
          .catch((err) => log.error("Site video analysis failed", err.message))
          .finally(() => fs.rmSync(tmp, { force: true }));
      });
      out.on("error", () => {
        if (!res.headersSent) res.status(500).json({ error: "Faylni saqlab bo'lmadi" });
      });
    });
  };

  return { register, handleTelegramVideo, analyze, analyzeFile, formatResult, _test: { probe, frameTimes } };
};

module.exports = { create, frameTimes, RESULT_TOOL };
