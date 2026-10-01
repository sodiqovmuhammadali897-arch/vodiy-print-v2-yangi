// Counts the server writes from amoCRM (meta-webhook/amocrm.js), one doc
// per amoCRM user per month, and how the "amoCRM tahlil" tab adds them up.

export type AmoDay = { leads: number; calls: number; talk_sec: number };
export type AmoToday = { day: string; total: number; answered: number; talk_sec: number; talked: number; first: string | null; last: string | null };
export type AmoStat = {
  id: string;
  month: string; // YYYY-MM
  amo_user_id: number; // 0 = no manager on the lead
  name: string;
  staff_email: string | null;
  leads: { created: number; won: number; lost: number; won_amount: number; open: number; stale: number };
  calls: { total: number; answered: number; talk_sec: number; in: number; out: number; talked: number };
  today: AmoToday | null; // current month only
  funnel: Record<string, number>; // "pipelineId:statusId" → open leads now
  sources: Record<string, number>;
  loss: Record<string, number>;
  daily: Record<string, AmoDay>;
  updated_at?: string;
};
export type AmoStatus = {
  ok?: boolean;
  error?: string | null;
  last_sync?: string;
  last_error_at?: string;
  host?: string;
  poll_minutes?: number;
  users?: { id: number; name: string }[];
  statuses?: Record<string, { name: string; pipeline: string; pipeline_sort: number; sort: number; color: string | null }>;
};

const addMap = (into: Record<string, number>, from: Record<string, number> | undefined) => {
  for (const [k, v] of Object.entries(from || {})) into[k] = (into[k] || 0) + Number(v || 0);
};

export function sumStats(rows: AmoStat[]) {
  const t = {
    leads: { created: 0, won: 0, lost: 0, won_amount: 0, open: 0, stale: 0 },
    calls: { total: 0, answered: 0, talk_sec: 0, in: 0, out: 0, talked: 0 },
    funnel: {} as Record<string, number>,
    sources: {} as Record<string, number>,
    loss: {} as Record<string, number>,
    daily: {} as Record<string, AmoDay>,
  };
  for (const r of rows) {
    for (const k of Object.keys(t.leads) as (keyof typeof t.leads)[]) t.leads[k] += Number(r.leads?.[k] || 0);
    // "talked" is unique people per manager; across managers it is summed.
    for (const k of Object.keys(t.calls) as (keyof typeof t.calls)[]) t.calls[k] += Number(r.calls?.[k] || 0);
    addMap(t.funnel, r.funnel);
    addMap(t.sources, r.sources);
    addMap(t.loss, r.loss);
    for (const [d, v] of Object.entries(r.daily || {})) {
      const cur = (t.daily[d] = t.daily[d] || { leads: 0, calls: 0, talk_sec: 0 });
      cur.leads += v.leads || 0;
      cur.calls += v.calls || 0;
      cur.talk_sec += v.talk_sec || 0;
    }
  }
  return t;
}

export const conversion = (won: number, created: number): number | null => (created > 0 ? (won / created) * 100 : null);

export const sortedEntries = (m: Record<string, number>) =>
  Object.entries(m)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

// Open leads by stage, in the pipeline's own order.
export function funnelRows(funnel: Record<string, number>, statuses: AmoStatus["statuses"] = {}) {
  const pipelines = new Set(Object.keys(funnel).map((k) => statuses[k]?.pipeline).filter(Boolean));
  return Object.entries(funnel)
    .map(([k, value]) => {
      const s = statuses[k];
      const name = s ? s.name : `Bosqich ${k.split(":")[1]}`;
      return { key: k, label: pipelines.size > 1 && s ? `${s.pipeline} · ${name}` : name, value, order: s ? [s.pipeline_sort, s.sort] : [9e9, 9e9] };
    })
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]);
}

// "1 soat 42 daq", "58 daq", "45 sek".
export function formatTalk(sec: number): string {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s} sek`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} daq`;
  return `${Math.floor(m / 60)} soat ${m % 60} daq`;
}

// "3 daq 54 sek".
export function formatAvgCall(totalSec: number, calls: number): string {
  if (!calls) return "—";
  const s = Math.round(totalSec / calls);
  return s < 60 ? `${s} sek` : `${Math.floor(s / 60)} daq ${s % 60} sek`;
}

// Minutes since the last call today, from "HH:MM" Tashkent time.
export function minutesSince(hm: string | null, now: Date): number | null {
  if (!hm) return null;
  const local = new Date(now.getTime() + 5 * 3600e3);
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [h, m] = hm.split(":").map(Number);
  return Math.max(0, nowMin - (h * 60 + m));
}
