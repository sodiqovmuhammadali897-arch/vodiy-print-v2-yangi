// Sotuv voronkasi (admin): the docs amo_funnel/{YYYY-MM} written by the
// server (meta-webhook/amoFunnel.js), turned into the steps, the leaks and
// the per-manager rates the page shows. Kept free of React so it can be
// tested.

export type FunnelRow = {
  leads: number;
  talked: number | null; // null: calls of that month were not loaded
  reached: Record<string, number>;
  won: number;
  lost: number;
  lost_no_reason: number;
  lost_after: Record<string, number>;
  ordered: number;
  paid: number;
  order_sum: number;
  first_call_min: number | null;
  lead_to_order_days: number | null;
};
export type FunnelDoc = {
  id: string;
  month: string;
  stages: { key: string; name: string; sort: number }[];
  info_key: string | null;
  offer_key: string | null;
  first_stage_key: string | null;
  calls_known: boolean;
  window_days: number;
  talk_sec: number;
  all: FunnelRow;
  users: (FunnelRow & { id: number; name: string })[];
  sources: { name: string; leads: number; ordered: number }[];
  speed: { first_call_min: number | null; lead_to_order_days: number | null; order_to_paid_days: number | null };
  hygiene: { stuck_first_stage: number; unused_stages: string[]; erp_orders: number; amo_won: number; lost_no_reason: number; lost: number };
  updated_at?: string;
};

export type Step = { key: string; title: string; source: "amoCRM" | "qo'ng'iroq" | "ERP"; n: number | null; conv: number | null; drop: number | null; dropText: string };

// Lead → talked → info → offer → order → paid. A step with no data (talked
// before calls were loaded) is kept with n = null and skipped when the
// next step's rate is worked out.
export function stepsOf(doc: Pick<FunnelDoc, "info_key" | "offer_key">, row: FunnelRow): Step[] {
  const raw: Omit<Step, "conv" | "drop">[] = [
    { key: "leads", title: "Lid keldi", source: "amoCRM", n: row.leads, dropText: "" },
    { key: "talked", title: "Gaplashildi", source: "qo'ng'iroq", n: row.talked, dropText: "bilan gaplashilmagan" },
    { key: "info", title: "Ma'lumot berildi", source: "amoCRM", n: doc.info_key ? row.reached[doc.info_key] || 0 : null, dropText: "keyingi qadam yo'q" },
    { key: "offer", title: "Taklif yuborildi", source: "amoCRM", n: doc.offer_key ? row.reached[doc.offer_key] || 0 : null, dropText: "taklif olmadi" },
    { key: "ordered", title: "Buyurtma", source: "ERP", n: row.ordered, dropText: "buyurtma bermadi" },
    { key: "paid", title: "To'landi", source: "ERP", n: row.paid, dropText: "hali to'lamagan" },
  ];
  let prev: number | null = null;
  return raw.map((s) => {
    const conv = prev !== null && prev > 0 && s.n !== null ? Math.round((s.n / prev) * 100) : null;
    const drop = prev !== null && s.n !== null ? prev - s.n : null;
    if (s.n !== null) prev = s.n;
    return { ...s, conv, drop };
  });
}

// The biggest losses between steps, biggest first; a step that grew (leads
// moved on without a call logged) is not a loss.
export function leaks(steps: Step[], n = 3): { from: string; to: string; lost: number }[] {
  const out: { from: string; to: string; lost: number }[] = [];
  let prev: Step | null = null;
  for (const s of steps) {
    if (s.n === null) continue;
    if (prev && s.drop !== null && s.drop > 0) out.push({ from: prev.title, to: s.title, lost: s.drop });
    prev = s;
  }
  return out.sort((a, b) => b.lost - a.lost).slice(0, n);
}

// The share of a row's leads that paid / ordered, in percent.
export const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

// A manager's step rate this many points under the team's is flagged.
export const BEHIND = 10;
export const behind = (mine: number | null, team: number | null) => mine !== null && team !== null && team - mine >= BEHIND;

// "2026-10" → "2026-09".
export const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};
