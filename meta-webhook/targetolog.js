// Targetolog agent — Facebook/Instagram ads through the Meta Marketing API.
//
// Every 15 minutes it reads the ad account: campaigns, ad sets (budgets)
// and daily results (leads + Direct conversations) for the last weeks, and
// writes them to Firestore for the Reklama page (ads_campaigns/*,
// ads_state/summary). Money is shown in so'm: the account currency times
// the rate in ads_settings/default.
//
// It never spends on its own. A change goes through ads_proposals:
//   budget / resume: review (marketolog) → approve (admin) → executed;
//   a campaign whose lead price is over N× the account average (or that
//   spends without results): a warning to both, and if nobody says
//   "Davom etsin" within the grace time it is paused — stopping only ever
//   lowers spend.
// Budget changes are refused when they would break the daily or monthly
// limit. Each step is logged in ads_log and posted to the 🎯 Reklama topic.
const { telegram: tgDefault } = require("./telegram");
const { emitEvent, clip } = require("./shared");

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const POLL_MS = 15 * 60 * 1000;
const DEFAULTS = { daily_limit: 200000, monthly_limit: 6000000, stop_multiplier: 3, grace_minutes: 120, rate: 12800, report_hour: 9 };
// Currencies Meta keeps without cents (budgets come in whole units).
const NO_CENTS = new Set(["JPY", "KRW", "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "PYG", "TWD", "VND"]);
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped", "onsite_conversion.messaging_conversation_started_7d"];
const OPEN_STAGES = ["warning", "review", "approve", "approved", "executing"];

const tashkent = (ms = Date.now()) => new Date(ms + TZ_OFFSET_MS);
const dayOf = (ms = Date.now()) => tashkent(ms).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const som = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s ]/g, " ")} so'm`;

// Stats over a set of days: spend in so'm, results, lead price.
const sumDays = (days, from, to) => {
  let spend = 0;
  let results = 0;
  for (const [d, v] of Object.entries(days)) {
    if (d >= from && d <= to) {
      spend += v.spend;
      results += v.results;
    }
  }
  return { spend: Math.round(spend), results, cpl: results ? Math.round(spend / results) : null };
};

const create = (db, { route, token = process.env.META_ADS_TOKEN, account = process.env.META_AD_ACCOUNT_ID, graphVersion = process.env.META_GRAPH_VERSION || "v19.0", fetchImpl = fetch, telegram = tgDefault, log = console } = {}) => {
  const act = String(account || "").replace(/^act_/, "");
  const enabled = Boolean(token && act);
  let timer = null;
  let expiryTimer = null;
  let running = false;
  let unwatch = null;
  let last = null; // the latest sync, for guards and the report

  // ── Graph API ──────────────────────────────────────────────────────
  const graph = async (path, params = {}, method = "GET") => {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${path}`);
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, access_token: token })) {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (method === "GET") url.searchParams.set(k, val);
      else body.set(k, val);
    }
    const res = await fetchImpl(url.toString(), { method, ...(method === "GET" ? {} : { body }), signal: AbortSignal.timeout(30000) });
    const data = await res.json().catch(() => ({}));
    if (data.error) throw new Error(`Meta: ${data.error.error_user_msg || data.error.message || "xato"}`);
    return data;
  };
  const graphAll = async (path, params) => {
    const out = [];
    let data = await graph(path, { limit: 200, ...params });
    for (let i = 0; i < 50; i++) {
      out.push(...(data.data || []));
      const next = data.paging && data.paging.next;
      if (!next) break;
      const res = await fetchImpl(next, { signal: AbortSignal.timeout(30000) });
      data = await res.json();
      if (data.error) throw new Error(`Meta: ${data.error.message}`);
    }
    return out;
  };

  const settings = async () => {
    const s = await db.collection("ads_settings").doc("default").get();
    return { ...DEFAULTS, ...(s.exists ? s.data() : {}) };
  };

  // ── people ─────────────────────────────────────────────────────────
  const staffAll = async () => (await db.collection("staff").get()).docs.map((d) => ({ email: d.id, ...d.data() }));
  const isAdmin = (s) => s && s.role === "admin";
  const isMarketer = (s) => s && !isAdmin(s) && Boolean(s.permissions && s.permissions.ads && s.permissions.ads.edit);
  const nameOf = (s) => (s && (s.full_name || s.email)) || "?";
  const byTelegram = async (id) => (await staffAll()).find((s) => String(s.telegram_chat_id || "") === String(id)) || null;

  const post = async (text) => {
    try {
      await telegram("sendMessage", { ...(await route("ads")), text, link_preview_options: { is_disabled: true } });
    } catch (err) {
      log.error("Targetolog post failed", err.message);
    }
  };
  const addLog = (text, by = "agent") => db.collection("ads_log").add({ text, by, at: new Date().toISOString() });

  // ── sync ───────────────────────────────────────────────────────────
  const sync = async () => {
    const cfg = await settings();
    const today = dayOf();
    const monthStart = `${today.slice(0, 7)}-01`;
    const since = [monthStart, addDays(today, -29)].sort()[0];
    const [acc, campaigns, adsets, rows] = await Promise.all([
      graph(`act_${act}`, { fields: "name,currency,account_status,spend_cap,amount_spent" }),
      graphAll(`act_${act}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget" }),
      graphAll(`act_${act}/adsets`, { fields: "id,name,campaign_id,status,effective_status,daily_budget" }),
      graphAll(`act_${act}/insights`, { level: "campaign", fields: "campaign_id,spend,actions", time_increment: 1, time_range: { since, until: today } }),
    ]);
    const currency = acc.currency || "USD";
    const rate = currency === "UZS" ? 1 : Number(cfg.rate) || DEFAULTS.rate;
    const offset = NO_CENTS.has(currency) ? 1 : 100;
    const minorToSom = (minor) => (Number(minor || 0) / offset) * rate;

    const days = new Map(); // campaign id → { day: { spend, results } }
    for (const r of rows) {
      const m = days.get(r.campaign_id) || {};
      const results = (r.actions || []).filter((a) => LEAD_ACTIONS.includes(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
      const d = r.date_start;
      m[d] = { spend: (m[d]?.spend || 0) + Number(r.spend || 0) * rate, results: (m[d]?.results || 0) + results };
      days.set(r.campaign_id, m);
    }

    const all = {};
    for (const m of days.values()) for (const [d, v] of Object.entries(m)) all[d] = { spend: (all[d]?.spend || 0) + v.spend, results: (all[d]?.results || 0) + v.results };
    const base = sumDays(all, addDays(today, -29), today);
    const avgCpl = base.cpl;

    const list = [];
    let activeDaily = 0;
    for (const c of campaigns) {
      if (["ARCHIVED", "DELETED"].includes(c.effective_status)) continue;
      const own = adsets.filter((a) => a.campaign_id === c.id && !["ARCHIVED", "DELETED"].includes(a.effective_status));
      const activeSets = own.filter((a) => a.status === "ACTIVE");
      // Campaign budget (CBO) or the ad sets' own budgets.
      const owner = c.daily_budget
        ? { kind: "campaign", id: c.id, minor: Number(c.daily_budget) }
        : activeSets.filter((a) => a.daily_budget).sort((a, b) => Number(b.daily_budget) - Number(a.daily_budget)).map((a) => ({ kind: "adset", id: a.id, minor: Number(a.daily_budget) }))[0] || null;
      const daily = c.daily_budget ? minorToSom(c.daily_budget) : activeSets.reduce((s, a) => s + minorToSom(a.daily_budget), 0);
      const active = c.status === "ACTIVE" && c.effective_status !== "PAUSED";
      if (active) activeDaily += daily;
      const d = days.get(c.id) || {};
      const trend = Array.from({ length: 7 }, (_, i) => d[addDays(today, i - 6)]?.results || 0);
      list.push({
        id: c.id,
        name: c.name,
        status: c.status,
        effective_status: c.effective_status,
        objective: c.objective || "",
        active,
        daily_budget: Math.round(daily),
        budget_owner: owner ? { ...owner, som: Math.round(minorToSom(owner.minor)) } : null,
        adsets: own.map((a) => ({ id: a.id, name: a.name, status: a.status, daily_budget: Math.round(minorToSom(a.daily_budget)) })),
        today: sumDays(d, today, today),
        yesterday: sumDays(d, addDays(today, -1), addDays(today, -1)),
        d3: sumDays(d, addDays(today, -2), today),
        d7: sumDays(d, addDays(today, -6), today),
        month: sumDays(d, monthStart, today),
        trend7: trend,
      });
    }

    const month = sumDays(all, monthStart, today);
    const summary = {
      ok: true,
      error: null,
      last_sync: new Date().toISOString(),
      account: { name: acc.name || "", currency, status: acc.account_status ?? null, rate },
      today: sumDays(all, today, today),
      yesterday: sumDays(all, addDays(today, -1), addDays(today, -1)),
      month,
      prev_month_same_days: sumDays(all, addDays(monthStart, -30), addDays(today, -30)),
      avg_cpl: avgCpl,
      active_daily_budget: Math.round(activeDaily),
      daily_limit: Number(cfg.daily_limit),
      monthly_limit: Number(cfg.monthly_limit),
      campaigns: list.length,
      active_campaigns: list.filter((c) => c.active).length,
    };

    const batch = db.batch();
    for (const c of list) batch.set(db.collection("ads_campaigns").doc(c.id), { ...c, updated_at: summary.last_sync });
    batch.set(db.collection("ads_state").doc("summary"), summary);
    await batch.commit();
    last = { cfg, list, summary, today, minorToSom, offset, rate };
    return last;
  };

  // ── proposals ──────────────────────────────────────────────────────
  const openFor = async (campaignId) => {
    const snap = await db.collection("ads_proposals").where("campaign_id", "==", campaignId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => OPEN_STAGES.includes(p.stage));
  };

  const propose = async (p) => {
    if ((await openFor(p.campaign_id)).length) return null;
    const now = new Date().toISOString();
    const ref = await db.collection("ads_proposals").add({ ...p, history: [{ at: now, by: "agent", action: "taklif" }], notified: {}, created_at: now, updated_at: now });
    await addLog(`Taklif: ${p.title}`);
    return ref.id;
  };

  // Lead price far above the average (or money with no results): warn,
  // then pause after the grace time unless someone keeps it running.
  const guard = async ({ cfg, list, summary }) => {
    const avg = summary.avg_cpl;
    if (!avg) return;
    const mult = Number(cfg.stop_multiplier) || 3;
    for (const c of list.filter((x) => x.active)) {
      const s = c.d3;
      const bad = s.spend >= avg * mult && (!s.results || s.cpl > avg * mult);
      if (!bad) continue;
      await propose({
        type: "pause",
        auto: true,
        stage: "warning",
        campaign_id: c.id,
        campaign_name: c.name,
        target: { kind: "campaign", id: c.id },
        title: `${c.name}: to'xtatish`,
        reason: `3 kunda ${som(s.spend)} sarflandi, ${s.results} natija${s.cpl ? ` (bittasi ${som(s.cpl)})` : ""}. O'rtacha lid narxi ${som(avg)} — ${mult} baravardan oshdi.`,
        deadline_at: new Date(Date.now() + (Number(cfg.grace_minutes) || 120) * 60000).toISOString(),
      });
    }
  };

  // Cheap campaigns with enough results: +50 % budget, within the limits.
  const growth = async ({ cfg, list, summary }) => {
    const avg = summary.avg_cpl;
    if (!avg) return;
    for (const c of list.filter((x) => x.active && x.budget_owner)) {
      const s = c.d7;
      if (s.results < 10 || !s.cpl || s.cpl > avg * 0.8) continue;
      const from = c.budget_owner.som;
      const to = Math.round((from * 1.5) / 1000) * 1000;
      if (summary.active_daily_budget - from + to > Number(cfg.daily_limit)) continue;
      await propose({
        type: "budget",
        auto: false,
        stage: "review",
        campaign_id: c.id,
        campaign_name: c.name,
        target: { kind: c.budget_owner.kind, id: c.budget_owner.id, from_som: from, to_som: to, from_minor: c.budget_owner.minor },
        title: `${c.name}: byudjet ${som(from)} → ${som(to)}`,
        reason: `7 kunda ${s.results} natija, bittasi ${som(s.cpl)} (o'rtacha ${som(avg)}). Kunlik byudjetni oshirish taklif qilinadi.`,
      });
    }
  };

  // ── checks before spending more ───────────────────────────────────
  const checkLimits = (p) => {
    if (!last) return "Meta ma'lumotlari hali o'qilmagan";
    const { cfg, summary, today } = last;
    const camp = last.list.find((c) => c.id === p.campaign_id);
    let newDaily = summary.active_daily_budget;
    if (p.type === "budget") newDaily += p.target.to_som - p.target.from_som;
    if (p.type === "resume" && camp && !camp.active) newDaily += camp.daily_budget;
    if (newDaily > Number(cfg.daily_limit)) return `Kunlik chegara ${som(cfg.daily_limit)}: faol reklamalar jami ${som(newDaily)} bo'lib qoladi`;
    const [y, m] = today.split("-").map(Number);
    const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - Number(today.slice(8, 10));
    const projected = summary.month.spend + newDaily * daysLeft;
    if (projected > Number(cfg.monthly_limit)) return `Oylik chegara ${som(cfg.monthly_limit)}: oy oxirigacha ${som(projected)} bo'lib qoladi`;
    return null;
  };

  const execute = async (id) => {
    const ref = db.collection("ads_proposals").doc(id);
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().stage !== "approved") return null;
      tx.update(ref, { stage: "executing", updated_at: new Date().toISOString() });
      return snap.data();
    });
    if (!claimed) return;
    const p = claimed;
    const finish = async (stage, note) => {
      const now = new Date().toISOString();
      await ref.update({ stage, result: note, updated_at: now, history: [...(p.history || []), { at: now, by: "agent", action: stage === "done" ? "bajarildi" : "xato", note }] });
      await addLog(`${stage === "done" ? "✅ Bajarildi" : "⚠️ Bajarilmadi"}: ${p.title}${note ? ` — ${note}` : ""}`);
      await post(`🎯 Reklama · ${stage === "done" ? "✅ Bajarildi" : "⚠️ Bajarilmadi"}: ${p.title}${note ? `\n${note}` : ""}`);
    };
    try {
      if (p.type === "pause") {
        await graph(p.target.id, { status: "PAUSED" }, "POST");
        await finish("done", p.auto ? "Avtomatik to'xtatildi (vaqt tugadi yoki tasdiqlandi)" : "To'xtatildi");
      } else {
        const why = checkLimits(p);
        if (why) return finish("failed", why);
        if (p.type === "budget") {
          const toMinor = Math.round((p.target.to_som / last.rate) * last.offset);
          await graph(p.target.id, { daily_budget: toMinor }, "POST");
          await finish("done", `Kunlik byudjet ${som(p.target.to_som)}`);
        } else if (p.type === "resume") {
          await graph(p.target.id, { status: "ACTIVE" }, "POST");
          await finish("done", "Yoqildi");
        }
      }
      await emitEvent(db, { agent: "mkt", kind: "report", text: `Reklama: ${p.title}`, bubble: "Reklamani o'zgartirdim 🎯", source: "ads" });
      sync().catch(() => undefined);
    } catch (err) {
      await finish("failed", err.message);
    }
  };

  // ── messages for each stage ───────────────────────────────────────
  const buttons = (rows) => ({ reply_markup: { inline_keyboard: [rows.map(([text, data]) => ({ text, callback_data: data }))] } });
  const textOf = (p) => `🎯 ${p.title}\n${p.reason}`;

  const announce = async (p) => {
    const people = await staffAll();
    const send = async (list, text, kb) => {
      for (const s of list.filter((x) => x.telegram_chat_id)) {
        await telegram("sendMessage", { chat_id: s.telegram_chat_id, text, ...kb }).catch(() => undefined);
      }
    };
    const marketers = people.filter(isMarketer);
    const admins = people.filter(isAdmin);
    if (p.stage === "warning") {
      const kb = buttons([["⏸ Hozir to'xtatish", `ads:st:${p.id}`], ["▶️ Davom etsin", `ads:go:${p.id}`]]);
      const text = `⚠️ ${textOf(p)}\n\n${new Date(Date.parse(p.deadline_at) + TZ_OFFSET_MS).toISOString().slice(11, 16)} gacha "Davom etsin" bosilmasa, reklama o'zi to'xtatiladi.`;
      await send([...marketers, ...admins], text, kb);
      await post(text);
    } else if (p.stage === "review") {
      if (!marketers.length) {
        // No marketer set up: straight to the admin.
        await db.collection("ads_proposals").doc(p.id).update({ stage: "approve", updated_at: new Date().toISOString() });
        return;
      }
      await send(marketers, `${textOf(p)}\n\nKo'rib chiqing: ma'qul bo'lsa admin tasdig'iga o'tadi.`, buttons([["✅ Adminga o'tkazish", `ads:rv:${p.id}`], ["❌ Rad etish", `ads:rj:${p.id}`]]));
    } else if (p.stage === "approve") {
      const by = (p.history || []).filter((h) => h.action === "ko'rib chiqdi").pop();
      await send(admins, `${textOf(p)}${by ? `\n\n👤 ${by.by} ko'rib chiqdi.` : ""}\n\nTasdiqlaysizmi?`, buttons([["✅ Tasdiqlash", `ads:ok:${p.id}`], ["❌ Rad etish", `ads:rj:${p.id}`]]));
    }
  };

  // Every stage change, from the page or from Telegram, lands here.
  const onChange = async (p) => {
    if (["warning", "review", "approve"].includes(p.stage) && !(p.notified || {})[p.stage]) {
      await db.collection("ads_proposals").doc(p.id).update({ [`notified.${p.stage}`]: true });
      await announce(p);
    } else if (p.stage === "approved") {
      await execute(p.id);
    } else if (["rejected", "kept"].includes(p.stage) && !(p.notified || {})[p.stage]) {
      await db.collection("ads_proposals").doc(p.id).update({ [`notified.${p.stage}`]: true });
      const by = (p.history || []).slice(-1)[0];
      await addLog(`${p.stage === "kept" ? "▶️ Davom ettirildi" : "❌ Rad etildi"}: ${p.title}${by ? ` (${by.by})` : ""}`);
    }
  };

  const watch = () => {
    if (unwatch) return;
    unwatch = db.collection("ads_proposals").where("stage", "in", ["warning", "review", "approve", "approved", "rejected", "kept"]).onSnapshot(
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "removed") onChange({ id: ch.doc.id, ...ch.doc.data() }).catch((err) => log.error("Targetolog stage failed", err));
        }
      },
      (err) => log.error("Targetolog watch failed", err),
    );
  };

  // Warnings nobody answered in time become a pause.
  const expireWarnings = async () => {
    const snap = await db.collection("ads_proposals").where("stage", "==", "warning").get();
    for (const d of snap.docs) {
      const p = d.data();
      if (p.deadline_at && Date.parse(p.deadline_at) <= Date.now()) {
        const now = new Date().toISOString();
        await d.ref.update({ stage: "approved", updated_at: now, history: [...(p.history || []), { at: now, by: "agent", action: "vaqt tugadi — to'xtatiladi" }] });
      }
    }
  };

  // ── Telegram buttons: ads:<rv|rj|ok|st|go>:<id> ───────────────────
  const handleCallback = async (cq) => {
    const answer = (text, alert = false) => telegram("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert });
    const m = /^ads:(rv|rj|ok|st|go):([A-Za-z0-9]+)$/.exec(cq.data || "");
    if (!m) return answer("Noma'lum tugma");
    const who = await byTelegram(cq.from && cq.from.id);
    if (!who || (!isAdmin(who) && !isMarketer(who))) return answer("Ruxsat yo'q", true);
    const ref = db.collection("ads_proposals").doc(m[2]);
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, msg: "Taklif topilmadi" };
      const p = snap.data();
      const step = {
        rv: { from: ["review"], to: "approve", who: isMarketer(who) || isAdmin(who), action: "ko'rib chiqdi", msg: "Admin tasdig'iga o'tkazildi" },
        rj: { from: ["review", "approve"], to: "rejected", who: p.stage === "approve" ? isAdmin(who) : true, action: "rad etdi", msg: "Rad etildi" },
        ok: { from: ["review", "approve"], to: "approved", who: isAdmin(who), action: "tasdiqladi", msg: "Tasdiqlandi — bajarilmoqda" },
        st: { from: ["warning"], to: "approved", who: true, action: "to'xtatishni tasdiqladi", msg: "To'xtatilmoqda" },
        go: { from: ["warning"], to: "kept", who: isAdmin(who), action: "davom ettirdi", msg: "Reklama davom etadi" },
      }[m[1]];
      if (!step.from.includes(p.stage)) return { ok: false, msg: "Bu taklif allaqachon ko'rib chiqilgan" };
      if (!step.who) return { ok: false, msg: m[1] === "go" ? "Davom ettirishni faqat admin hal qiladi" : "Buni faqat admin tasdiqlaydi" };
      const now = new Date().toISOString();
      tx.update(ref, { stage: step.to, updated_at: now, history: [...(p.history || []), { at: now, by: nameOf(who), action: step.action }] });
      return { ok: true, msg: step.msg };
    });
    if (res.ok && cq.message) {
      await telegram("editMessageText", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: `${cq.message.text}\n\n${res.msg} — ${nameOf(who)}`.slice(0, 4000) }).catch(() => undefined);
    }
    return answer(res.msg, !res.ok);
  };

  // ── morning report ────────────────────────────────────────────────
  const report = async () => {
    if (!last) return;
    const { list, summary, cfg } = last;
    const y = summary.yesterday;
    const ranked = list.filter((c) => c.yesterday.spend > 0).sort((a, b) => (a.yesterday.cpl ?? 9e15) - (b.yesterday.cpl ?? 9e15));
    const best = ranked.find((c) => c.yesterday.results);
    const worst = [...ranked].reverse().find((c) => c !== best);
    const lines = [
      "📊 Reklama — ertalabki hisobot",
      `Kecha: ${som(y.spend)} sarflandi · ${y.results} natija${y.cpl ? ` (bittasi ${som(y.cpl)})` : ""}`,
      best ? `🥇 Eng yaxshi: ${best.name} — ${best.yesterday.results} natija, ${som(best.yesterday.cpl)}dan` : "",
      worst ? `🔻 Eng qimmat: ${worst.name} — ${som(worst.yesterday.spend)}, ${worst.yesterday.results} natija` : "",
      `Oy: ${som(summary.month.spend)} / ${som(cfg.monthly_limit)} (${Math.round((summary.month.spend / Number(cfg.monthly_limit)) * 100)}%) · faol reklamalar kuniga ${som(summary.active_daily_budget)} (chegara ${som(cfg.daily_limit)})`,
    ].filter(Boolean);
    await post(lines.join("\n"));
    await emitEvent(db, { agent: "mkt", kind: "report", text: clip(lines.slice(0, 2).join(" · "), 200), bubble: "Reklama hisoboti 📊", source: "ads" });
  };

  const daily = async () => {
    if (!last) return;
    const hour = tashkent().getUTCHours();
    if (hour < Number(last.cfg.report_hour || 9)) return;
    const run = db.collection("ads_runs").doc(dayOf());
    try {
      await run.create({ at: new Date().toISOString() });
    } catch {
      return;
    }
    await report();
    await growth(last);
    // Spending past the daily limit (a budget changed in Meta itself).
    if (last.summary.active_daily_budget > Number(last.cfg.daily_limit)) {
      await post(`⚠️ Faol reklamalar kuniga ${som(last.summary.active_daily_budget)} — kunlik chegaradan (${som(last.cfg.daily_limit)}) oshib ketgan. Meta'da byudjetlarni tekshiring.`);
    }
  };

  const tick = async () => {
    if (!enabled || running) return;
    running = true;
    try {
      watch();
      const s = await sync();
      await guard(s);
      await expireWarnings();
      await daily();
    } catch (err) {
      log.error("Targetolog sync failed", err.message || err);
      await db.collection("ads_state").doc("summary").set({ ok: false, error: String(err.message || err).slice(0, 300), last_error_at: new Date().toISOString() }, { merge: true }).catch(() => undefined);
    } finally {
      running = false;
    }
  };

  const start = async () => {
    if (!enabled) {
      log.log("META_ADS_TOKEN / META_AD_ACCOUNT_ID not set — Targetolog off.");
      return;
    }
    await tick();
    timer = setInterval(() => tick().catch((err) => log.error("Targetolog tick failed", err)), POLL_MS);
    // Answers and deadlines between syncs.
    expiryTimer = setInterval(() => expireWarnings().catch(() => undefined), 60 * 1000);
    log.log(`Targetolog started (act_${act}, every ${POLL_MS / 60000} min)`);
  };
  const stop = () => {
    clearInterval(timer);
    clearInterval(expiryTimer);
    if (unwatch) unwatch();
  };

  return { start, stop, tick, handleCallback, enabled, _test: { sync, guard, growth, checkLimits, execute, report, onChange, expireWarnings } };
};

module.exports = { create, sumDays, DEFAULTS };
