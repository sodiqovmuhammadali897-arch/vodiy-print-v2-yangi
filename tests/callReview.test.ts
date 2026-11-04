import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("../meta-webhook/callReview");

const now = Date.parse("2026-11-04T15:00:00+05:00");
const call = (id: string, ago: number, extra = {}) => ({ id, manager: "Ali", dir: "out", duration: 150, record: "https://x/r.aac", at: new Date(now - ago * 3600000).toISOString(), ...extra });

describe("AI ROP", () => {
  it("picks recent long recorded amoCRM calls, spread over managers", () => {
    const calls = [
      call("1", 1),
      call("2", 2),
      call("3", 3, { manager: "Vali" }),
      call("4", 4, { duration: 40 }), // too short
      call("5", 5, { record: "" }), // no recording
      call("6", 24 * 9), // too old
      call("7", 6, { manager: "" }), // no manager
    ];
    const picked = R.pickCalls({ calls, reviewed: new Set(["2x"]), n: 3, now });
    expect(picked.map((c: { id: string }) => c.id)).toEqual(["1", "3", "2"]); // Ali, Vali, then Ali again
    expect(R.pickCalls({ calls, reviewed: new Set(["1", "2", "3"]), n: 5, now }).map((c: { id: string }) => c.id)).toEqual(["7"]);
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
