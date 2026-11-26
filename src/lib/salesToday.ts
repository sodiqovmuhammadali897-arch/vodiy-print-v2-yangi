// The main Bosh sahifa's «Bugungi sotuv» block (2026-11-26; the owner: «bosh
// sahifada bugungi gaplashgan vaqti, zadachalari, kirish nechta, chiqish
// nechta»). Pure helpers; the block is src/modules/dashboard/SalesToday.tsx.
import { talkSeconds, type CallRow } from "./crmDash";
import { unreturned } from "./callsLog";
import type { Lead } from "./types";

export type CallStats = {
  in: number;
  inTalk: number; // seconds
  inAnswered: number;
  inMissed: number;
  out: number;
  outTalk: number;
  outAnswered: number;
  talk: number;
  talks: number; // 30 s and more
  first: string | null; // HH:MM of the first call
};

const hm = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16) : null);

export function callStats(calls: CallRow[]): CallStats {
  const s: CallStats = { in: 0, inTalk: 0, inAnswered: 0, inMissed: 0, out: 0, outTalk: 0, outAnswered: 0, talk: 0, talks: 0, first: null };
  for (const c of calls) {
    const t = talkSeconds(c);
    if (c.direction === "in") {
      s.in++;
      s.inTalk += t;
      if (c.answered) s.inAnswered++;
      else s.inMissed++;
    } else {
      s.out++;
      s.outTalk += t;
      if (c.answered) s.outAnswered++;
    }
    s.talk += t;
    if (t >= 30) s.talks++;
    const h = hm(c.start_time || c.created_at);
    if (h && (!s.first || h < s.first)) s.first = h;
  }
  return s;
}

// Missed incoming calls nobody called back yet that are this person's:
// the lead is theirs, or the call has no owner yet (anyone may return it).
// `email` "" = everyone's.
export function myUnreturned(calls: CallRow[], leads: Pick<Lead, "id" | "assigned_to_email">[], email: string): CallRow[] {
  const owner = new Map(leads.map((l) => [l.id, l.assigned_to_email || ""]));
  return unreturned(calls).filter((c) => {
    if (!email) return true;
    const o = c.lead_id ? owner.get(c.lead_id) || "" : "";
    return o === email || !o;
  });
}

// A seller's own calls: the ones they made or took.
export const callsOf = (calls: CallRow[], email: string) => (email ? calls.filter((c) => c.staff_email === email) : calls);

export const minutes = (sec: number) => Math.round(sec / 60);
