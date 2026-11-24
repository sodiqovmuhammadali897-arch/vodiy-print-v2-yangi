// Reklama 2.0 — «pul qayerga ketdi» (the owner, 2026-11-24: «har bir sent
// biz uchun qadrli»). meta-webhook/adsSpend.js writes ads_days/{day}: every
// ad's spend that day in dollars and in so'm at that day's Central Bank
// rate; this sums any period and builds campaign → ad set → ad.

export type AdsDayAd = { c: string; cn: string; s: string; sn: string; a: string; an: string; usd: number; spend: number; impr: number; clicks: number; link: number; leads: number; chats: number; erp: number; v3?: number };
export type AudRow = { k: string; usd: number; spend: number; impr: number; clicks: number; leads: number; chats: number };
export type VideoDayRow = { a: string; plays: number; p25: number; p50: number; p75: number; p95: number; p100: number; thru: number; avg_sum: number };
export type Creatives = Record<string, { vid: string; thumb: string; name: string }>;
export type AdsPlacement = { plat: string; pos: string; usd: number; spend: number; impr: number; clicks: number; leads: number; chats: number };
export type AdsDay = {
  day: string;
  rate: number;
  ads: AdsDayAd[];
  totals: { usd: number; spend: number; impr: number; clicks: number; link: number; leads: number; chats: number; erp: number; results: number; reach?: number };
  placements?: AdsPlacement[];
  aud?: { age?: AudRow[]; region?: AudRow[]; hour?: AudRow[]; device?: AudRow[] };
  video?: VideoDayRow[];
  aud_at?: string;
  updated_at?: string;
};

export type Sums = { usd: number; spend: number; impr: number; clicks: number; link: number; leads: number; chats: number; erp: number };
export type Node = Sums & { id: string; name: string; children: Node[] };

export type PeriodKey = "today" | "yesterday" | "d7" | "d30" | "month" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "d7", label: "7 kun" },
  { key: "d30", label: "30 kun" },
  { key: "month", label: "Shu oy" },
  { key: "custom", label: "Davr" },
];

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function periodSpan(key: PeriodKey, today: string, custom?: { from: string; to: string }): { from: string; to: string } {
  if (key === "today") return { from: today, to: today };
  if (key === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
  if (key === "d7") return { from: addDays(today, -6), to: today };
  if (key === "d30") return { from: addDays(today, -29), to: today };
  if (key === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  const from = custom?.from || today;
  const to = custom?.to || today;
  return from <= to ? { from, to } : { from: to, to: from };
}

const zero = (): Sums => ({ usd: 0, spend: 0, impr: 0, clicks: 0, link: 0, leads: 0, chats: 0, erp: 0 });
const SUM_KEYS: (keyof Sums)[] = ["usd", "spend", "impr", "clicks", "link", "leads", "chats", "erp"];
const add = (t: Sums, a: Sums) => {
  for (const k of SUM_KEYS) t[k] += Number(a[k] || 0);
};

export function aggregate(days: AdsDay[], from: string, to: string) {
  const inSpan = days.filter((d) => d.day >= from && d.day <= to);
  const totals = zero();
  let erpOutside = 0;
  const camps = new Map<string, Node>();
  for (const d of inSpan) {
    let erpRows = 0;
    for (const a of d.ads || []) {
      add(totals, a);
      erpRows += a.erp || 0;
      const c = camps.get(a.c) || { id: a.c, name: a.cn, ...zero(), children: [] };
      add(c, a);
      let s = c.children.find((x) => x.id === a.s);
      if (!s) c.children.push((s = { id: a.s, name: a.sn, ...zero(), children: [] }));
      add(s, a);
      let ad = s.children.find((x) => x.id === a.a);
      if (!ad) s.children.push((ad = { id: a.a, name: a.an, ...zero(), children: [] }));
      add(ad, a);
      camps.set(a.c, c);
    }
    erpOutside += Math.max(0, Number(d.totals?.erp || 0) - erpRows);
  }
  totals.erp += erpOutside;
  totals.usd = Math.round(totals.usd * 100) / 100;
  const sort = (n: Node[]): Node[] => n.sort((a, b) => b.spend - a.spend).map((x) => ({ ...x, children: sort(x.children) }));
  const places = new Map<string, AdsPlacement>();
  for (const d of inSpan)
    for (const p of d.placements || []) {
      const k = `${p.plat}/${p.pos}`;
      const cur = places.get(k) || { plat: p.plat, pos: p.pos, usd: 0, spend: 0, impr: 0, clicks: 0, leads: 0, chats: 0 };
      cur.usd += p.usd;
      cur.spend += p.spend;
      cur.impr += p.impr;
      cur.clicks += p.clicks;
      cur.leads += p.leads;
      cur.chats += p.chats;
      places.set(k, cur);
    }
  const single = from === to ? inSpan[0] : undefined;
  return {
    totals,
    tree: sort([...camps.values()]),
    placements: [...places.values()].sort((a, b) => b.spend - a.spend),
    reach: single?.totals?.reach ?? null,
    rate: inSpan.length ? inSpan[inSpan.length - 1].rate : null,
    days: inSpan.length,
    updated_at: inSpan.map((d) => d.updated_at || "").sort().pop() || null,
  };
}

// Ratios worked out from the sums — never averages of rows.
export const metrics = (s: Sums) => {
  const results = s.leads + s.chats;
  return {
    results,
    cpl: results ? Math.round(s.spend / results) : null,
    cpm: s.impr ? Math.round((s.spend / s.impr) * 1000) : null,
    ctr: s.impr ? Math.round((s.link / s.impr) * 10000) / 100 : null,
    cpc: s.link ? Math.round(s.spend / s.link) : null,
  };
};

const PLACE: Record<string, string> = {
  instagram_reels: "Reels",
  instagram_stories: "Stories",
  feed: "Lenta",
  facebook_reels: "Reels",
  facebook_stories: "Stories",
  instagram_explore: "Explore",
  instagram_explore_grid_home: "Explore",
  instagram_explore_grid_home_feed: "Explore",
  instream_video: "Video ichida",
  rewarded_video: "Mukofotli video",
  instagram_search: "Qidiruv",
  marketplace: "Marketplace",
  video_feeds: "Video lenta",
  right_hand_column: "O'ng ustun",
  an_classic: "Klassik",
};
const PLAT: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", audience_network: "Audience Network", messenger: "Messenger" };
export const placeLabel = (p: { plat: string; pos: string }) => `${PLAT[p.plat] || p.plat} · ${PLACE[p.pos] || p.pos.replace(/_/g, " ")}`;

export const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
export const pctLabel = (n: number) => `${String(n).replace(".", ",")}%`;

// ── Phase 2: who saw it, when, and how the videos were watched ─────────
export type AudKind = "age" | "region" | "hour" | "device";
export function aggregateAudience(days: AdsDay[], from: string, to: string) {
  const inSpan = days.filter((d) => d.day >= from && d.day <= to);
  const out = {} as Record<AudKind, AudRow[]>;
  for (const kind of ["age", "region", "hour", "device"] as AudKind[]) {
    const by = new Map<string, AudRow>();
    for (const d of inSpan)
      for (const r of d.aud?.[kind] || []) {
        const cur = by.get(r.k) || { k: r.k, usd: 0, spend: 0, impr: 0, clicks: 0, leads: 0, chats: 0 };
        cur.usd += r.usd;
        cur.spend += r.spend;
        cur.impr += r.impr;
        cur.clicks += r.clicks;
        cur.leads += r.leads;
        cur.chats += r.chats;
        by.set(r.k, cur);
      }
    out[kind] = [...by.values()];
  }
  out.age.sort((a, b) => a.k.localeCompare(b.k));
  out.region.sort((a, b) => b.spend - a.spend);
  out.device.sort((a, b) => b.spend - a.spend);
  // All 24 hours, so empty hours show as empty.
  const hours = new Map(out.hour.map((h) => [h.k, h]));
  out.hour = Array.from({ length: 24 }, (_, i) => {
    const k = String(i).padStart(2, "0");
    return hours.get(k) || { k, usd: 0, spend: 0, impr: 0, clicks: 0, leads: 0, chats: 0 };
  });
  return { ...out, has: inSpan.some((d) => d.aud), at: inSpan.map((d) => d.aud_at || "").sort().pop() || null };
}

export type VideoStat = {
  key: string;
  name: string;
  thumb: string;
  ads: number;
  spend: number;
  usd: number;
  impr: number;
  results: number;
  erp: number;
  v3: number;
  plays: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p100: number;
  thru: number;
  avgSec: number | null;
  cpl: number | null;
};

// One row per video: the same video in several ad sets is one row
// (Meta's video id; else the ad's name).
export function aggregateVideos(days: AdsDay[], from: string, to: string, creatives: Creatives = {}): VideoStat[] {
  const inSpan = days.filter((d) => d.day >= from && d.day <= to);
  const keyOf = (adId: string, name: string) => creatives[adId]?.vid || `n:${name.trim().toLowerCase()}`;
  const adName = new Map<string, string>();
  const by = new Map<string, VideoStat & { avgSum: number; adIds: Set<string> }>();
  const get = (adId: string, name: string) => {
    const k = keyOf(adId, name);
    let v = by.get(k);
    if (!v) {
      v = { key: k, name: name || creatives[adId]?.name || "Video", thumb: "", ads: 0, spend: 0, usd: 0, impr: 0, results: 0, erp: 0, v3: 0, plays: 0, p25: 0, p50: 0, p75: 0, p95: 0, p100: 0, thru: 0, avgSec: null, cpl: null, avgSum: 0, adIds: new Set() };
      by.set(k, v);
    }
    if (!v.thumb && creatives[adId]?.thumb) v.thumb = creatives[adId].thumb;
    v.adIds.add(adId);
    return v;
  };
  for (const d of inSpan) {
    for (const a of d.ads || []) {
      adName.set(a.a, a.an);
      const v = get(a.a, a.an);
      v.spend += a.spend;
      v.usd += a.usd;
      v.impr += a.impr;
      v.results += a.leads + a.chats;
      v.erp += a.erp || 0;
      v.v3 += a.v3 || 0;
    }
    for (const r of d.video || []) {
      const v = get(r.a, adName.get(r.a) || creatives[r.a]?.name || "");
      v.plays += r.plays;
      v.p25 += r.p25;
      v.p50 += r.p50;
      v.p75 += r.p75;
      v.p95 += r.p95;
      v.p100 += r.p100;
      v.thru += r.thru;
      v.avgSum += r.avg_sum;
    }
  }
  return [...by.values()]
    .filter((v) => v.plays > 0 || v.spend > 0)
    .map(({ avgSum, adIds, ...v }) => ({ ...v, ads: adIds.size, avgSec: v.plays ? Math.round((avgSum / v.plays) * 10) / 10 : null, cpl: v.results ? Math.round(v.spend / v.results) : null }))
    .sort((a, b) => b.spend - a.spend);
}

// Plain-language hints about the videos (compared with each other).
export function videoHints(videos: VideoStat[]): string[] {
  const seen = videos.filter((v) => v.plays >= 300 && v.impr > 0);
  if (seen.length < 2) return [];
  const hook = (v: VideoStat) => (v.v3 ? v.v3 / v.impr : v.plays / v.impr);
  const hold = (v: VideoStat) => v.p25 / v.plays;
  const best = [...seen].sort((a, b) => hold(b) - hold(a))[0];
  const worst = [...seen].sort((a, b) => hold(a) - hold(b))[0];
  const p = (x: number) => `${String(Math.round(x * 1000) / 10).replace(".", ",")}%`;
  const out = [`✅ Eng yaxshi ushlab turgan video: «${best.name}» — ${p(hold(best))} odam chorakkacha ko'rgan.`];
  if (worst !== best && hold(worst) < hold(best) / 2) out.push(`⚠️ «${worst.name}» — chorakkacha atigi ${p(hold(worst))} ko'rgan: boshidagi 3 soniyani (hook) almashtirib sinab ko'ring.`);
  const lowHook = [...seen].sort((a, b) => hook(a) - hook(b))[0];
  if (lowHook !== worst && hook(lowHook) < hook(best) / 2) out.push(`👀 «${lowHook.name}» — ko'rganlarning atigi ${p(hook(lowHook))} 3 soniyadan ko'p to'xtagan.`);
  const noRes = seen.filter((v) => v.spend > 0 && !v.results).sort((a, b) => b.spend - a.spend)[0];
  if (noRes) out.push(`🔴 «${noRes.name}» — ${Math.round(noRes.spend).toLocaleString("ru-RU").replace(/[\s\u00a0]/g, " ")} so'm ketdi, natija yo'q.`);
  return out;
}

const REGION: Record<string, string> = {
  "Fergana Region": "Farg'ona",
  "Andijan Region": "Andijon",
  "Namangan Region": "Namangan",
  "Tashkent": "Toshkent shahri",
  "Tashkent Region": "Toshkent viloyati",
  "Samarqand Region": "Samarqand",
  "Samarkand Region": "Samarqand",
  "Bukhara Region": "Buxoro",
  "Jizzakh Region": "Jizzax",
  "Khorezm Region": "Xorazm",
  "Navoiy Region": "Navoiy",
  "Kashkadarya Region": "Qashqadaryo",
  "Surxondaryo Region": "Surxondaryo",
  "Sirdaryo Region": "Sirdaryo",
  "Karakalpakstan": "Qoraqalpog'iston",
  Unknown: "Noma'lum",
};
export const regionLabel = (k: string) => REGION[k] || k.replace(/ Region$/, "");
const GENDER: Record<string, string> = { male: "erkak", female: "ayol", unknown: "noma'lum" };
export const ageLabel = (k: string) => {
  const [age, g] = k.split("|");
  return `${age} · ${GENDER[g] || g}`;
};
const DEVICE: Record<string, string> = { mobile_app: "Telefon (ilova)", mobile_web: "Telefon (brauzer)", desktop: "Kompyuter", unknown: "Noma'lum" };
export const deviceLabel = (k: string) => DEVICE[k] || k;
