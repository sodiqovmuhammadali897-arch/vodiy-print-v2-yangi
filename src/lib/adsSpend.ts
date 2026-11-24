// Reklama 2.0 — «pul qayerga ketdi» (the owner, 2026-11-24: «har bir sent
// biz uchun qadrli»). meta-webhook/adsSpend.js writes ads_days/{day}: every
// ad's spend that day in dollars and in so'm at that day's Central Bank
// rate; this sums any period and builds campaign → ad set → ad.

export type AdsDayAd = { c: string; cn: string; s: string; sn: string; a: string; an: string; usd: number; spend: number; impr: number; clicks: number; link: number; leads: number; chats: number; erp: number };
export type AdsPlacement = { plat: string; pos: string; usd: number; spend: number; impr: number; clicks: number; leads: number; chats: number };
export type AdsDay = {
  day: string;
  rate: number;
  ads: AdsDayAd[];
  totals: { usd: number; spend: number; impr: number; clicks: number; link: number; leads: number; chats: number; erp: number; results: number; reach?: number };
  placements?: AdsPlacement[];
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
