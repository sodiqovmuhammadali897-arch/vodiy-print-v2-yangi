// Reklama 2.0 — «har bir so'm qayerga ketdi» (the owner, 2026-11-24:
// «kunlik hamma budjetni qayerga sarflanayotganini bilishimiz kerak, har
// bir sent biz uchun qadrli»). Pure helpers for targetolog.js:
//
//   ads_days/{YYYY-MM-DD}: every ad's spend that day (campaign → ad set →
//   ad), impressions, clicks, Meta leads, ERP leads, the account's reach,
//   and spend by platform/placement. So'm = dollars × THAT day's Central
//   Bank rate (ads_fx/{day}, cbu.uz) — not a fixed rate.
//
// Today's doc is rewritten every 2 minutes (one ad-level call + one account
// call); older days and placements every 30 minutes. A day is always
// written whole (set, not add), so the same answer twice never doubles.

const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped", "leadgen_grouped"];
const CHAT_TYPE = "onsite_conversion.messaging_conversation_started_7d";
const num = (v) => Number(v || 0) || 0;
const actionsOf = (actions) => {
  const v = (t) => (actions || []).filter((a) => a.action_type === t).reduce((s, a) => s + num(a.value), 0);
  return { leads: Math.max(0, ...LEAD_TYPES.map(v)), chats: v(CHAT_TYPE), v3: v("video_view") };
};
// Meta's video fields are lists like [{ action_type: "video_view", value }].
const listVal = (r, f) => (Array.isArray(r[f]) ? r[f].reduce((s, a) => s + num(a.value), 0) : num(r[f]));
const r2 = (n) => Math.round(n * 100) / 100;

// One day from Meta's ad-level rows (already that day's only).
function buildDay({ day, rate, rows = [], account = null, placements = null, erpByAd = {} }) {
  const ads = [];
  const t = { usd: 0, spend: 0, impr: 0, clicks: 0, link: 0, leads: 0, chats: 0, erp: 0 };
  for (const r of rows) {
    const usd = num(r.spend);
    const { leads, chats } = actionsOf(r.actions);
    const erp = num(erpByAd[String(r.ad_id)]);
    if (!usd && !leads && !chats && !num(r.impressions) && !erp) continue;
    const a = {
      c: String(r.campaign_id || ""),
      cn: String(r.campaign_name || ""),
      s: String(r.adset_id || ""),
      sn: String(r.adset_name || ""),
      a: String(r.ad_id || ""),
      an: String(r.ad_name || ""),
      usd: r2(usd),
      spend: Math.round(usd * rate),
      impr: num(r.impressions),
      clicks: num(r.clicks),
      link: num(r.inline_link_clicks),
      leads,
      chats,
      v3: actionsOf(r.actions).v3,
      erp,
    };
    ads.push(a);
    for (const k of ["usd", "impr", "clicks", "link", "leads", "chats", "erp"]) t[k] += a[k];
  }
  t.usd = r2(t.usd);
  t.spend = Math.round(t.usd * rate);
  t.results = t.leads + t.chats;
  // ERP leads whose ad had no Meta row that day (late attribution).
  for (const [ad, n] of Object.entries(erpByAd)) if (!ads.some((a) => a.a === ad)) t.erp += num(n);
  if (account) {
    t.reach = num(account.reach);
    t.acc_impr = num(account.impressions);
  }
  const out = { day, rate, ads: ads.sort((x, y) => y.usd - x.usd), totals: t };
  if (placements) out.placements = placementRows(placements, rate);
  return out;
}

function placementRows(rows, rate) {
  return rows
    .map((r) => {
      const { leads, chats } = actionsOf(r.actions);
      const usd = num(r.spend);
      return { plat: String(r.publisher_platform || "unknown"), pos: String(r.platform_position || "unknown"), usd: r2(usd), spend: Math.round(usd * rate), impr: num(r.impressions), clicks: num(r.clicks), leads, chats };
    })
    .filter((p) => p.usd > 0 || p.impr > 0 || p.leads)
    .sort((a, b) => b.usd - a.usd);
}

// Phase 2 — who saw it and when (one day's rows of one breakdown).
// `key` names the row: "25-34 male", "Fergana Region", "15", "mobile_app".
const AUD_KEYS = {
  age: (r) => `${r.age || "?"}|${r.gender || "unknown"}`,
  region: (r) => String(r.region || "Unknown"),
  hour: (r) => String(r.hourly_stats_aggregated_by_advertiser_time_zone || "").slice(0, 2),
  device: (r) => String(r.device_platform || "unknown"),
};
function audienceRows(rows, rate, kind) {
  const by = new Map();
  for (const r of rows || []) {
    const k = AUD_KEYS[kind](r);
    const { leads, chats } = actionsOf(r.actions);
    const cur = by.get(k) || { k, usd: 0, spend: 0, impr: 0, clicks: 0, leads: 0, chats: 0 };
    cur.usd = r2(cur.usd + num(r.spend));
    cur.spend = Math.round(cur.usd * rate);
    cur.impr += num(r.impressions);
    cur.clicks += num(r.inline_link_clicks || r.clicks);
    cur.leads += leads;
    cur.chats += chats;
    by.set(k, cur);
  }
  return [...by.values()].filter((x) => x.usd > 0 || x.impr > 0 || x.leads);
}

// Video watching per ad that day: starts, 25/50/75/95/100%, ThruPlay, and
// the average watch time × starts (so days add up to a true average).
const VIDEO_FIELDS = "ad_id,ad_name,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions,video_thruplay_watched_actions,video_avg_time_watched_actions";
function videoRows(rows) {
  return (rows || [])
    .map((r) => {
      const plays = listVal(r, "video_play_actions");
      return {
        a: String(r.ad_id || ""),
        plays,
        p25: listVal(r, "video_p25_watched_actions"),
        p50: listVal(r, "video_p50_watched_actions"),
        p75: listVal(r, "video_p75_watched_actions"),
        p95: listVal(r, "video_p95_watched_actions"),
        p100: listVal(r, "video_p100_watched_actions"),
        thru: listVal(r, "video_thruplay_watched_actions"),
        avg_sum: r2(listVal(r, "video_avg_time_watched_actions") * plays),
      };
    })
    .filter((v) => v.plays > 0);
}

// Group rows that carry date_start by day.
const byDay = (rows) => {
  const m = new Map();
  for (const r of rows || []) {
    const d = String(r.date_start || "").slice(0, 10);
    if (!d) continue;
    if (!m.has(d)) m.set(d, []);
    m.get(d).push(r);
  }
  return m;
};

// The highest share Meta reports in its usage headers (0–100).
function usagePct(headers) {
  let max = 0;
  for (const name of ["x-business-use-case-usage", "x-ad-account-usage", "x-app-usage"]) {
    const raw = headers && (typeof headers.get === "function" ? headers.get(name) : headers[name]);
    if (!raw) continue;
    try {
      const j = JSON.parse(raw);
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        for (const [k, v] of Object.entries(o)) {
          if (["call_count", "total_cputime", "total_time", "acc_id_util_pct"].includes(k) && Number.isFinite(Number(v))) max = Math.max(max, Number(v));
          else if (typeof v === "object") walk(v);
        }
      };
      walk(j);
    } catch {
      /* not JSON */
    }
  }
  return max;
}

// Central Bank of Uzbekistan rate for a day (the nearest earlier one on
// weekends). `cache` holds ads_fx docs: { [day]: rate }.
async function cbuRate(day, fetchImpl = fetch) {
  const res = await fetchImpl(`https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/${day}/`, { signal: AbortSignal.timeout(15000) });
  const j = await res.json();
  const rate = Number(j && j[0] && j[0].Rate);
  if (!(rate > 1000)) throw new Error("CBU: kurs topilmadi");
  return { rate, date: String(j[0].Date || "") };
}

// Limit checks for today's alert: which lines to send (once a day each).
function limitAlerts({ today, month, activeDaily, dailyLimit, monthlyLimit, daysLeft, rate }) {
  const out = [];
  const som = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s ]/g, " ")} so'm`;
  if (monthlyLimit > 0 && month >= monthlyLimit)
    out.push({ key: "month_over", text: `🔴 Oylik reklama limiti oshdi: ${som(month)} / ${som(monthlyLimit)} — ${String(Math.round((month / monthlyLimit) * 1000) / 10).replace(".", ",")}%, ortiqcha ${som(month - monthlyLimit)}.` });
  else if (monthlyLimit > 0 && month + activeDaily * daysLeft > monthlyLimit * 1.02)
    out.push({ key: "month_forecast", text: `🟠 Shu tezlikda oy oxirigacha ≈ ${som(month + activeDaily * daysLeft)} sarflanadi — oylik limit ${som(monthlyLimit)} dan oshadi.` });
  if (dailyLimit > 0 && today >= dailyLimit) out.push({ key: "day_over", text: `🔴 Bugungi reklama sarfi limitdan oshdi: ${som(today)} / ${som(dailyLimit)}.` });
  if (dailyLimit > 0 && activeDaily > dailyLimit * 1.02) out.push({ key: "budget_over", text: `🟠 Faol reklamalar kuniga ${som(activeDaily)} sarflashga sozlangan — kunlik limit ${som(dailyLimit)} dan ${som(activeDaily - dailyLimit)} ko'p.` });
  if (out.length && rate) out.push({ key: "_rate", text: `Kurs: 1 $ = ${som(rate)} (Markaziy bank). Budjetga tegmadim — faqat xabar.` });
  return out;
}

module.exports = { audienceRows, videoRows, VIDEO_FIELDS, AUD_KEYS, buildDay, placementRows, byDay, usagePct, cbuRate, limitAlerts, actionsOf };
