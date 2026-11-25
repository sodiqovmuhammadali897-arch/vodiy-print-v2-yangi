// Sotuv bo'limi → «Qo'ng'iroqlar» (2026-11-25, moving off amoCRM): one day
// of the calls Mois Zvonki posts to the server (`calls`), with who took
// them, talk time, recordings and the missed ones nobody returned.
import { talkSeconds, type CallRow } from "./crmDash";

const TZ = 5 * 3600e3;
export const tashkentDay = (ms = Date.now()) => new Date(ms + TZ).toISOString().slice(0, 10);
export const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
// The day's span in stored ISO time (Tashkent midnight = 19:00 UTC before).
export const dayBounds = (day: string) => ({ from: new Date(Date.parse(`${day}T00:00:00Z`) - TZ).toISOString(), to: new Date(Date.parse(`${day}T00:00:00Z`) - TZ + 86400e3 - 1).toISOString() });
const at = (c: CallRow) => c.start_time || c.created_at;
const digits = (p?: string) => String(p || "").replace(/\D/g, "").slice(-9);

export type CallKind = "all" | "in" | "out" | "missed";
export const isMissed = (c: CallRow) => c.direction === "in" && !c.answered;

// A missed incoming call with no later answered call to or from that number.
export function unreturned(calls: CallRow[]): CallRow[] {
  const sorted = [...calls].sort((a, b) => at(a).localeCompare(at(b)));
  return sorted.filter((c, i) => isMissed(c) && !sorted.slice(i + 1).some((x) => digits(x.phone) === digits(c.phone) && (x.answered || x.direction === "out")));
}

export function callSummary(calls: CallRow[]) {
  const talk = calls.reduce((s, c) => s + talkSeconds(c), 0);
  return {
    total: calls.length,
    inbound: calls.filter((c) => c.direction === "in").length,
    outbound: calls.filter((c) => c.direction === "out").length,
    talked: calls.filter((c) => talkSeconds(c) >= 30).length,
    missed: calls.filter(isMissed).length,
    unreturned: unreturned(calls).length,
    talk,
  };
}

export function filterCalls(calls: CallRow[], kind: CallKind, staff: string): CallRow[] {
  return calls
    .filter((c) => !staff || c.staff_email === staff)
    .filter((c) => (kind === "in" ? c.direction === "in" : kind === "out" ? c.direction === "out" : kind === "missed" ? isMissed(c) : true))
    .sort((a, b) => at(b).localeCompare(at(a)));
}

export const timeOf = (c: CallRow) => new Date(Date.parse(at(c)) + TZ).toISOString().slice(11, 16);
