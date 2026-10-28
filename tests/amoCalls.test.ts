import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const C = require("../meta-webhook/amoCalls");

// Tashkent time → ms.
const at = (s: string) => Date.parse(`${s}:00+05:00`);
let n = 0;
const call = (time: string, extra: Record<string, unknown> = {}) => ({
  id: `c${++n}`,
  user: 7,
  at: at(`2026-10-22T${time}`),
  duration: 60,
  dir: "out",
  key: "k1",
  entity: "l",
  entityId: 100,
  lead: 100,
  ...extra,
});
const lead = (id: number, created: string, extra: Record<string, unknown> = {}) => ({
  id,
  created: at(`2026-10-22T${created}`),
  updated: at(`2026-10-22T${created}`),
  status: 10,
  user: 7,
  contact: null,
  name: `Lid ${id}`,
  source: "Instagram",
  ...extra,
});

describe("amoCRM calls in detail", () => {
  it("sums up a manager's day", () => {
    const d = C.summarizeDay([
      call("10:05", { duration: 0, dir: "in", key: "k2", lead: null }),
      call("08:52", { duration: 120 }),
      call("09:00", { duration: 300, key: "k2", lead: 101 }),
      call("09:50", { duration: 30, key: "k3", lead: 101 }),
    ]);
    expect(d).toMatchObject({ first: "08:52", last: "10:05", total: 4, answered: 3, in: 1, out: 3, missed_in: 1, talk_sec: 450, longest: 300, talked: 3, leads_talked: 2 });
    // 09:05 → 09:50 is a 45 minute pause; the others are shorter.
    expect(d.gaps).toBe(1);
    expect(d.hours).toEqual({ "08": 1, "09": 2, "10": 1 });
  });

  it("finds missed incoming calls nobody followed up", () => {
    const now = at("2026-10-22T11:00");
    const { open, returned } = C.missedIncoming(
      [
        call("09:00", { dir: "in", duration: 0, key: "a" }),
        call("09:04", { dir: "in", duration: 0, key: "a" }), // the same request again
        call("09:20", { dir: "out", duration: 0, key: "a" }), // called back (no answer still counts)
        call("10:30", { dir: "in", duration: 0, key: "b" }),
        call("10:40", { dir: "in", duration: 45, key: "c" }),
      ],
      "2026-10-22",
      now,
    );
    expect(returned.map((r: { key: string; back_after: number }) => [r.key, r.back_after / 60000])).toEqual([["a", 20]]);
    expect(open.map((o: { key: string; waiting: number }) => [o.key, o.waiting / 60000])).toEqual([["b", 30]]);
  });

  it("links a call on a contact to that contact's lead", () => {
    const leadOf = C.leadIndex([lead(1, "08:00", { contact: 50, status: 143 }), lead(2, "09:00", { contact: 50 })]);
    expect(leadOf({ entity: "c", entityId: 50 }).id).toBe(2); // the open one
    expect(leadOf({ entity: "l", entityId: 1 }).id).toBe(1);
    expect(leadOf({ entity: "c", entityId: 99 })).toBeNull();
  });

  it("tells which of today's leads got a call and how fast", () => {
    const leads = [lead(1, "09:00"), lead(2, "10:00"), lead(3, "10:30")];
    const calls = [call("09:12", { entityId: 1 }), call("10:30", { entityId: 2 })];
    const leadOf = C.leadIndex(leads);
    const s = C.newLeads(leads, calls, "2026-10-22", at("2026-10-22T11:00"), leadOf).get(7);
    expect(s).toMatchObject({ count: 3, called: 2, avg_first_min: 21 });
    expect(s.waiting).toEqual([{ id: 3, name: "Lid 3", source: "Instagram", created: "10:30", wait_min: 30 }]);
  });

  it("writes the Telegram notices", () => {
    expect(C.lateStartText([], "2026-10-22")).toBeNull();
    expect(C.lateStartText(["Aziza"], "2026-10-22")).toContain("22-oktyabr, 09:30");
    const m = C.missedText({ at: at("2026-10-22T10:00"), phone: "+998 90 123 45 67" }, { manager: "Dilnoza", who: null, now: at("2026-10-22T10:17") });
    expect(m).toContain("+998 90 123 45 67 — 10:00 da qo'ng'iroq qilgan, 17 daq o'tdi.");
    expect(m).toContain("Menejer: Dilnoza");
    const sum = C.daySummaryText(
      "2026-10-22",
      [
        { name: "Aziza", first: "09:44", last: "17:55", total: 29, answered: 19, talked: 13, leads_talked: 9, talk_sec: 2460, gaps: 3 },
        { name: "Dilnoza", first: "08:52", last: "18:41", total: 58, answered: 46, talked: 31, leads_talked: 22, talk_sec: 6480, gaps: 0 },
      ],
      { missedOpen: 2, newLeads: { count: 18, called: 15, waiting: 3 } },
    );
    expect(sum).toContain("Qo'ng'iroq: 87 (javob: 65) · gaplashgan: 44 odam, 31 lid");
    expect(sum).toContain("ish boshlandi: 08:52");
    expect(sum.indexOf("Dilnoza")).toBeLessThan(sum.indexOf("Aziza"));
    expect(sum).toContain("tanaffus 30+: 3");
    expect(C.talk(6480)).toBe("1 s 48 daq");
  });
});

describe("javobsiz qo'ng'iroqni qaytarish", () => {
  const missed = { key: "k1", at: Date.parse("2026-11-02T10:00:00+05:00") };
  const c = (min: number, dir: string, duration: number, key = "k1") => ({ key, at: missed.at + min * 60000, dir, duration });

  it("finds the first call back to the same number", () => {
    const calls = [c(-5, "out", 60), c(3, "in", 0), c(7, "out", 0, "k2"), c(12, "out", 95), c(20, "out", 30)];
    const back = C.followUpOf(calls, missed);
    expect(back.at).toBe(missed.at + 12 * 60000);
    expect(C.followUpLine(back)).toBe("✅ Javob qaytarildi — 10:12, 1 daq gaplashildi");
  });

  it("counts an unanswered call back as tried, and an answered incoming call as handled", () => {
    expect(C.followUpLine(C.followUpOf([c(4, "out", 0)], missed))).toContain("mijoz ko'tarmadi");
    expect(C.followUpOf([c(4, "in", 40)], missed)).not.toBeNull();
    expect(C.followUpOf([c(4, "in", 0)], missed)).toBeNull();
  });
});
