// Counts the server writes from amoCRM (meta-webhook/amocrm.js), one doc
// per amoCRM user per month, and how the "amoCRM tahlil" tab adds them up.

// A day of one manager. The fields after talk_sec come from the detailed
// call report (meta-webhook/amoCalls.js); older docs don't have them.
export type AmoDayDetail = {
  first?: string | null;
  last?: string | null;
  answered?: number;
  talked?: number; // people (phone numbers) talked to
  leads_talked?: number;
  gaps?: number; // pauses of 30+ minutes between calls
  missed_in?: number;
  longest?: number;
};
export type AmoDay = { leads: number; calls: number; talk_sec: number } & AmoDayDetail;
export type AmoMissed = { at: string; phone: string; lead_id: number | string | null; lead_name: string; waiting_min: number };
export type AmoNewLeads = {
  count: number;
  called: number;
  avg_first_min: number | null;
  waiting: { id: number; name: string; source: string; created: string; wait_min: number }[];
};
export type AmoToday = {
  day: string;
  total: number;
  answered: number;
  talk_sec: number;
  talked: number;
  first: string | null;
  last: string | null;
  in?: number;
  out?: number;
  missed_in?: number;
  longest?: number;
  leads_talked?: number;
  gaps?: number;
  hours?: Record<string, number>;
  new_leads?: AmoNewLeads;
  missed_open?: AmoMissed[];
  missed_returned?: number;
  missed_back_min?: number;
};
// One call (amo_calls), written by the server for the last 31 days.
export type AmoCall = {
  id: string;
  day: string;
  at: string;
  hm: string;
  amo_user_id: number;
  manager: string;
  staff_email: string | null;
  dir: "in" | "out";
  duration: number;
  answered: boolean;
  phone: string;
  contact: string;
  lead_id: number | string | null;
  lead_name: string;
  stage: string;
};
// An open lead as the server lists it for Sotuv nazorati (no contacts).
export type AmoLeadBrief = { id: number; name: string; price: number; stage: string; updated: string };
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
  stale_list?: AmoLeadBrief[]; // open leads untouched 3+ days, current month only
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
  leads?: number;
  unsorted?: number;
  leads_this_month?: number;
  newest_lead_at?: string | null;
  calls_loaded?: number;
  calls_this_month?: number;
  server_month?: string;
  users_count?: number;
  stages_count?: number;
  server_time?: string;
  newest_lead_id?: string | null;
  max_lead_id?: number;
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
      const [pipelineId, statusId] = k.split(":");
      // Not yet accepted ("Неразобранное"): first, before the pipeline's stages.
      const sibling = Object.entries(statuses).find(([key]) => key.startsWith(`${pipelineId}:`))?.[1];
      const s = statusId === "-1" ? (sibling ? { ...sibling, name: "Saralanmagan", sort: -1 } : undefined) : statuses[k];
      const name = s ? s.name : statusId === "-1" ? "Saralanmagan" : `Bosqich ${statusId}`;
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

// A manager's row for one day of the call report: today's live numbers,
// or the day from the month's daily record.
export type DayRow = {
  user: number;
  name: string;
  first: string | null;
  last: string | null;
  total: number;
  answered: number;
  talked: number;
  leads_talked: number;
  talk_sec: number;
  longest: number;
  gaps: number;
};
export function dayRows(people: AmoStat[], day: string): DayRow[] {
  const rows: DayRow[] = [];
  for (const p of people) {
    if (!p.amo_user_id) continue;
    const t = p.today && p.today.day === day ? p.today : null;
    const d = t ? { ...t, calls: t.total } : p.daily?.[day];
    if (!d || !(d.calls || 0)) continue;
    rows.push({
      user: p.amo_user_id,
      name: p.name,
      first: d.first ?? null,
      last: d.last ?? null,
      total: d.calls || 0,
      answered: d.answered ?? 0,
      talked: d.talked ?? 0,
      leads_talked: d.leads_talked ?? 0,
      talk_sec: d.talk_sec || 0,
      longest: d.longest ?? 0,
      gaps: d.gaps ?? 0,
    });
  }
  return rows.sort((a, b) => b.talk_sec - a.talk_sec);
}

// Calls per hour of the working day, per manager: { user: { "09": 4, … } }.
export function hourGrid(calls: AmoCall[]): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  for (const c of calls) {
    const h = c.hm.slice(0, 2);
    const row = out.get(c.amo_user_id) || {};
    row[h] = (row[h] || 0) + 1;
    out.set(c.amo_user_id, row);
  }
  return out;
}

// "08:52" or later than the start of the working day.
export const LATE_START = "09:30";
export const isLateStart = (first: string | null) => Boolean(first && first > LATE_START);

// "2:13" — minutes and seconds.
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
