// Reklama (Targetolog agent): what meta-webhook/targetolog.js writes, and
// the stage rules the page and firestore.rules share. Money is in so'm.

export type AdsPeriod = { spend: number; results: number; cpl: number | null };

export type AdsSummary = {
  ok?: boolean;
  error?: string | null;
  last_sync?: string;
  last_error_at?: string;
  account?: { name: string; currency: string; status: number | null; rate: number };
  today?: AdsPeriod;
  yesterday?: AdsPeriod;
  month?: AdsPeriod;
  prev_month_same_days?: AdsPeriod;
  avg_cpl?: number | null;
  active_daily_budget?: number;
  daily_limit?: number;
  monthly_limit?: number;
  campaigns?: number;
  active_campaigns?: number;
};

export type AdsCampaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  active: boolean;
  daily_budget: number;
  today: AdsPeriod;
  yesterday: AdsPeriod;
  d3: AdsPeriod;
  d7: AdsPeriod;
  month: AdsPeriod;
  trend7: number[];
  updated_at?: string;
};

export type AdsStage = "warning" | "review" | "approve" | "approved" | "executing" | "done" | "failed" | "rejected" | "kept";

export type AdsProposal = {
  id: string;
  type: "pause" | "budget" | "resume";
  auto: boolean;
  stage: AdsStage;
  campaign_id: string;
  campaign_name: string;
  title: string;
  reason: string;
  result?: string;
  deadline_at?: string;
  target: { kind: string; id: string; from_som?: number; to_som?: number };
  history: { at: string; by: string; action: string; note?: string }[];
  created_at: string;
  updated_at: string;
};

export type AdsSettings = {
  daily_limit: number;
  monthly_limit: number;
  stop_multiplier: number;
  grace_minutes: number;
  rate: number;
  report_hour: number;
};

export const ADS_DEFAULTS: AdsSettings = { daily_limit: 200000, monthly_limit: 6000000, stop_multiplier: 3, grace_minutes: 120, rate: 12800, report_hour: 9 };

export const OPEN_STAGES: AdsStage[] = ["warning", "review", "approve", "approved", "executing"];

// The moves a person may make — the same as firestore.rules.
export type AdsMove = { to: AdsStage; label: string; tone: "ok" | "no" | "neutral"; action: string };
export function movesFor(stage: AdsStage, role: { admin: boolean; marketer: boolean }): AdsMove[] {
  const out: AdsMove[] = [];
  if (stage === "warning") {
    if (role.admin || role.marketer) out.push({ to: "approved", label: "⏸ Hozir to'xtatish", tone: "ok", action: "to'xtatishni tasdiqladi" });
    if (role.admin) out.push({ to: "kept", label: "▶ Davom etsin", tone: "neutral", action: "davom ettirdi" });
  } else if (stage === "review") {
    if (role.admin) out.push({ to: "approved", label: "✓ Tasdiqlash", tone: "ok", action: "tasdiqladi" });
    else if (role.marketer) out.push({ to: "approve", label: "✓ Adminga o'tkazish", tone: "ok", action: "ko'rib chiqdi" });
    if (role.admin || role.marketer) out.push({ to: "rejected", label: "Rad etish", tone: "no", action: "rad etdi" });
  } else if (stage === "approve" && role.admin) {
    out.push({ to: "approved", label: "✓ Tasdiqlash", tone: "ok", action: "tasdiqladi" });
    out.push({ to: "rejected", label: "Rad etish", tone: "no", action: "rad etdi" });
  }
  return out;
}

// How a lead price compares with the account average.
export function cplTone(cpl: number | null | undefined, avg: number | null | undefined, multiplier = 3): "good" | "ok" | "bad" | "none" {
  if (!cpl || !avg) return "none";
  if (cpl <= avg) return "good";
  if (cpl <= avg * multiplier) return "ok";
  return "bad";
}

export const formatSom = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s ]/g, " ")}`;
