import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("../meta-webhook/callReview");

const now = Date.parse("2026-11-04T15:00:00+05:00");
const call = (id: string, ago: number, extra = {}) => ({ id, phone: "+998 90 123 45 67", direction: "out", answered: true, duration_seconds: 150, recording_url: "https://x/r.aac", start_time: new Date(now - ago * 3600000).toISOString(), ...extra });
const amo = (phone: string, at: string, manager: string) => ({ phone, at, manager, dir: "out", staff_email: `${manager}@vp.uz` });

describe("AI ROP", () => {
  it("finds the manager of a call through amoCRM", () => {
    const c = call("a", 1);
    const at = new Date(Date.parse(c.start_time) + 60000).toISOString();
    expect(R.matchManager(c, [amo("901234567", at, "Nuriddin"), amo("901234567", new Date(Date.parse(c.start_time) + 10 * 60000).toISOString(), "X")])).toMatchObject({ manager: "Nuriddin" });
    expect(R.matchManager(c, [amo("909999999", at, "Nuriddin")])).toBeNull();
  });

  it("picks recent long recorded calls, spread over managers", () => {
    const calls = [
      call("1", 1, { phone: "901111111" }),
      call("2", 2, { phone: "901111111" }),
      call("3", 3, { phone: "902222222" }),
      call("4", 4, { duration_seconds: 40 }), // too short
      call("5", 5, { recording_url: "" }), // no recording
      call("6", 24 * 9), // too old
      call("7", 6, { phone: "903333333" }), // nobody matched
    ];
    const amoCalls = [
      amo("901111111", calls[0].start_time, "Ali"),
      amo("901111111", calls[1].start_time, "Ali"),
      amo("902222222", calls[2].start_time, "Vali"),
    ];
    const picked = R.pickCalls({ calls, amoCalls, reviewed: new Set(["2x"]), n: 3, now });
    expect(picked.map((c: { id: string }) => c.id)).toEqual(["1", "3", "2"]); // Ali, Vali, then Ali again
    expect(R.pickCalls({ calls, amoCalls, reviewed: new Set(["1", "2", "3"]), n: 5, now }).map((c: { id: string }) => c.id)).toEqual(["7"]);
  });

  it("writes a report without customer data", () => {
    const review = { sales_call: true, topic: "Paket narxi", steps: [{ key: "kontakt", done: "ha", note: "" }, { key: "ramka", done: "yo'q", note: "" }], score: 55, talk_share: "teng", best: "Tez javob berdi", missed: "Ramka yo'q", advice: "«Avval 3 ta savol beraman» deng", outcome: "aniq kelishuv yo'q" };
    const text = R.reportText([
      { manager: "Nuriddin", direction: "out", duration: 150, review, phone: "+998901234567" },
      { manager: "Ali", direction: "in", duration: 100, review: { ...review, sales_call: false } },
    ]);
    expect(text).toContain("O'rtacha ball: 55/100 · sotuv suhbati: 1/2");
    expect(text).toContain("1. Nuriddin · chiquvchi · 2:30 · 55/100");
    expect(text).toContain("✅Kontakt ❌Ramka");
    expect(text).toContain("Ko'p tushib qolgan: Ramka (1)");
    expect(text).not.toContain("998901234567");
  });

  it("asks Claude for every step", () => {
    expect(R.REVIEW_TOOL.input_schema.properties.steps.items.properties.key.enum).toEqual(R.STEPS.map((s: { key: string }) => s.key));
    expect(R.SYSTEM).toContain("Kontakt");
  });
});
