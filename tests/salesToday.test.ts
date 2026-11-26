import { describe, expect, it } from "vitest";
import { callStats, myUnreturned } from "../src/lib/salesToday";
import type { CallRow } from "../src/lib/crmDash";

const iso = (s: string) => new Date(Date.parse(`${s}:00+05:00`)).toISOString();
const C = (id: string, o: Partial<CallRow>): CallRow => ({ id, created_at: iso("2026-11-26T10:00"), ...o }) as CallRow;

describe("Bugungi sotuv", () => {
  it("incoming and outgoing with minutes", () => {
    const s = callStats([
      C("1", { direction: "in", answered: true, start_time: iso("2026-11-26T09:10"), answer_time: iso("2026-11-26T09:10"), end_time: iso("2026-11-26T09:12") }),
      C("2", { direction: "in", answered: false, start_time: iso("2026-11-26T09:20") }),
      C("3", { direction: "out", answered: true, start_time: iso("2026-11-26T08:55"), duration_seconds: 20 }),
      C("4", { direction: "out", answered: false, start_time: iso("2026-11-26T11:00") }),
    ]);
    expect(s).toMatchObject({ in: 2, inTalk: 120, inAnswered: 1, inMissed: 1, out: 2, outTalk: 20, outAnswered: 1, talk: 140, talks: 1, first: "08:55" });
  });
  it("missed calls not returned: mine and the ownerless", () => {
    const calls = [
      C("m1", { direction: "in", answered: false, phone: "+998901111111", lead_id: "L1", created_at: iso("2026-11-26T09:00") }),
      C("m2", { direction: "in", answered: false, phone: "+998902222222", lead_id: "L2", created_at: iso("2026-11-26T09:05") }),
      C("m3", { direction: "in", answered: false, phone: "+998903333333", created_at: iso("2026-11-26T09:10") }),
      C("m4", { direction: "in", answered: false, phone: "+998904444444", lead_id: "L1", created_at: iso("2026-11-26T09:15") }),
      C("back", { direction: "out", answered: false, phone: "904444444", created_at: iso("2026-11-26T09:30") }),
    ];
    const leads = [{ id: "L1", assigned_to_email: "me" }, { id: "L2", assigned_to_email: "other" }];
    expect(myUnreturned(calls, leads, "me").map((c) => c.id)).toEqual(["m1", "m3"]);
    // a lead this manager cannot see is someone else's
    expect(myUnreturned(calls, [{ id: "L1", assigned_to_email: "me" }], "me").map((c) => c.id)).toEqual(["m1", "m3"]);
    expect(myUnreturned(calls, leads, "").map((c) => c.id)).toEqual(["m1", "m2", "m3"]);
  });
});
