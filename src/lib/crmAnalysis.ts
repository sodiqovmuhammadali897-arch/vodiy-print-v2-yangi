// Sotuv bo'limi → Tahlil → «ERP tahlili» (step 4, 2026-11-26): the analysis
// from the ERP's own leads instead of amoCRM. A cohort is the leads that
// came in the period (by created_at); for them: how far they got, which
// sources and which managers turn leads into orders, and why leads were lost.
// Pure; the page is src/modules/leads/crm/CrmAnalysis.tsx.
import { CRM_COLUMNS, columnOf, isOldLead, type CrmColumn } from "./crm";
import { inSpan, type Span } from "./crmDash";
import type { Lead, Order } from "./types";

type OrderLite = Pick<Order, "status" | "total_amount"> & Partial<Pick<Order, "created_at" | "order_number">>;

export type AnalysisPeriod = "month" | "prev_month" | "d30" | "d90";
export const ANALYSIS_PERIODS: [AnalysisPeriod, string][] = [
  ["month", "Bu oy"],
  ["prev_month", "O'tgan oy"],
  ["d30", "30 kun"],
  ["d90", "90 kun"],
];

const DAY = 86400e3;
const TZ = 5 * 3600e3;
export function analysisSpan(kind: AnalysisPeriod, now = Date.now()): Span {
  const d = new Date(now + TZ);
  const monthStart = (k: number) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) - TZ;
  if (kind === "prev_month") return { from: monthStart(-1), to: monthStart(0) };
  if (kind === "d30") return { from: now - 30 * DAY, to: now };
  if (kind === "d90") return { from: now - 90 * DAY, to: now };
  return { from: monthStart(0), to: now };
}

export type Row = { key: string; label: string; leads: number; won: number; sum: number; lost: number; open: number; conv: number };

export function crmAnalysis({ leads, orders, span, owner = "" }: { leads: Lead[]; orders: Record<string, OrderLite>; span: Span; owner?: string }) {
  const cohort = leads.filter((l) => !isOldLead(l) && inSpan(l.created_at, span) && (!owner || l.assigned_to_email === owner));
  const col = (l: Lead) => columnOf(l, orders);
  const order = (l: Lead) => (l.converted_order_id ? orders[l.converted_order_id] : undefined);
  const isWon = (l: Lead) => Boolean(order(l) && order(l)!.status !== "cancelled");
  const isLost = (l: Lead) => !isWon(l) && (l.status === "lost" || col(l) === null);
  const sumOf = (list: Lead[]) => list.reduce((s, l) => s + (Number(order(l)?.total_amount) || 0), 0);
  const idx = (c: CrmColumn) => CRM_COLUMNS.findIndex((x) => x.key === c);

  const row = (key: string, label: string, list: Lead[]): Row => {
    const won = list.filter(isWon);
    const lost = list.filter(isLost).length;
    return { key, label, leads: list.length, won: won.length, sum: sumOf(won), lost, open: list.length - won.length - lost, conv: list.length ? won.length / list.length : 0 };
  };
  const groupBy = (key: (l: Lead) => [string, string]) => {
    const m = new Map<string, { label: string; list: Lead[] }>();
    for (const l of cohort) {
      const [k, label] = key(l);
      if (!m.has(k)) m.set(k, { label, list: [] });
      m.get(k)!.list.push(l);
    }
    return [...m.entries()].map(([k, v]) => row(k, v.label, v.list)).sort((a, b) => b.leads - a.leads || b.sum - a.sum);
  };

  // How far the cohort got. A lost lead's last stage is not kept, so it
  // counts only in the first bar; the drop-off shows as «yo'qotildi».
  const reached = (l: Lead, i: number) => {
    if (isWon(l)) return i <= Math.max(idx("advance"), idx(col(l) || "advance"));
    const k = col(l);
    return k ? idx(k) >= i : i === 0;
  };
  const funnel = CRM_COLUMNS.map((c, i) => ({ key: c.key, label: c.label, color: c.color, i, n: cohort.filter((l) => reached(l, i)).length }));

  const reasons = new Map<string, number>();
  for (const l of cohort.filter(isLost)) reasons.set(l.lost_reason || "Sababsiz", (reasons.get(l.lost_reason || "Sababsiz") || 0) + 1);

  return {
    total: row("all", "Hammasi", cohort),
    funnel,
    sources: groupBy((l) => [l.source || "Boshqa", l.source || "Boshqa"]),
    managers: groupBy((l) => (l.assigned_to_email ? [l.assigned_to_email, l.assigned_to_name || l.assigned_to_email] : ["", "Biriktirilmagan"])),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n })),
    fromAmo: cohort.filter((l) => l.amo_id).length,
    // For the lists a click opens.
    cohort,
    reached,
    isWon,
    isLost,
  };
}
