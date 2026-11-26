import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const D = require("../meta-webhook/erpDaily.js");

const iso = (s: string) => new Date(Date.parse(`${s}:00+05:00`)).toISOString();
const at = (s: string) => Date.parse(`${s}:00+05:00`);
const C = (id: string, o: Record<string, unknown>) => ({ id, phone: "+998901234567", direction: "in", answered: false, staff_email: "", ...o });

describe("ERP missed calls", () => {
  const calls = [
    C("m1", { start_time: iso("2026-11-26T10:00"), created_at: iso("2026-11-26T10:01") }),
    C("m2", { phone: "911112233", start_time: iso("2026-11-26T10:05") }),
    C("back", { phone: "+998 91 111 22 33", direction: "out", answered: true, start_time: iso("2026-11-26T10:10"), answer_time: iso("2026-11-26T10:10"), end_time: iso("2026-11-26T10:12") }),
    C("m3", { phone: "93", start_time: iso("2026-11-26T10:00") }), // no real number
  ];
  it("raised after 15 minutes, unless called back", () => {
    expect(D.toRaise(calls, at("2026-11-26T10:10"), {}).map((c: { id: string }) => c.id)).toEqual([]);
    expect(D.toRaise(calls, at("2026-11-26T10:20"), {}).map((c: { id: string }) => c.id)).toEqual(["m1"]);
    expect(D.toRaise(calls, at("2026-11-26T10:20"), { m1: {} })).toEqual([]);
    expect(D.toRaise(calls, at("2026-11-26T12:30"), {})).toEqual([]); // older than 2 h
  });
  it("the follow-up closes it", () => {
    const back = D.followUpOf(calls, calls[1]);
    expect(back.id).toBe("back");
    expect(D.followUpLine(back)).toBe("✅ Javob qaytarildi — 10:10, 2 daq gaplashildi");
    expect(D.followUpLine({ direction: "out", answered: false, start_time: iso("2026-11-26T10:30") })).toContain("ko'tarmadi");
  });
});

describe("ERP 19:00", () => {
  it("the day", () => {
    const calls = [
      { id: "1", staff_email: "a@vp", direction: "out", answered: true, start_time: iso("2026-11-26T09:05"), answer_time: iso("2026-11-26T09:05"), end_time: iso("2026-11-26T09:08") },
      { id: "2", staff_email: "a@vp", direction: "in", answered: true, start_time: iso("2026-11-26T17:40"), answer_time: iso("2026-11-26T17:40"), end_time: iso("2026-11-26T17:40:20".slice(0, 16)) },
      { id: "3", staff_email: "b@vp", direction: "out", answered: false, start_time: iso("2026-11-26T11:00") },
    ];
    const text = D.daySummaryText("2026-11-26", calls, new Map([["a@vp", "Ali"], ["b@vp", "Bek"]]), { newLeads: 4, missedLeft: 1 });
    expect(text).toContain("📊 Sotuv bo'limi · 26-noyabr · ERP");
    expect(text).toContain("Qo'ng'iroq: 3 (chiquvchi 2, kiruvchi 1) · gaplashildi (30 s+): 1");
    expect(text).toContain("Yangi lidlar: 4");
    expect(text).toContain("⚠️ Qaytarilmagan javobsiz qo'ng'iroq: 1");
    expect(text).toContain("• Ali: 09:05–17:40, 2 qo'ng'iroq, 1 suhbat");
    expect(D.daySummaryText("2026-11-26", [], new Map())).toBeNull();
  });
  it("leads lost today", () => {
    const lost = [
      { lost_reason: "Narx qimmat", assigned_to_name: "Ali", estimated_amount: 2_000_000 },
      { lost_reason: "Narx qimmat", assigned_to_name: "Bek" },
      { lost_reason: "", assigned_to_name: "" },
    ];
    const text = D.lostText("2026-11-26", lost, [...lost, {}]);
    expect(text).toContain("Jami: 3 ta · 2 mln so'm");
    expect(text).toContain("• Narx qimmat — 2");
    expect(text).toContain("• Sabab yozilmagan — 1");
    expect(text).toContain("• Mas'ul yo'q — 1");
    expect(text).toContain("Oy boshidan: 4 ta");
    expect(D.lostText("2026-11-26", [])).toBeNull();
  });
  it("09:30", () => {
    expect(D.lateStartText(["Ali"], "2026-11-26")).toContain("• Ali");
    expect(D.lateStartText([], "2026-11-26")).toBeNull();
  });
});
