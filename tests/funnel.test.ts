import { describe, expect, it } from "vitest";
import { behind, leaks, lossReasons, pct, prevMonth, stepsOf } from "../src/lib/funnel";

const row = { leads: 745, talked: 512, reached: { i: 238, o: 131 }, won: 24, lost: 466, lost_no_reason: 466, lost_after: {}, ordered: 94, paid: 81, order_sum: 0, first_call_min: 14, lead_to_order_days: 6 };
const doc = { info_key: "i", offer_key: "o" };

describe("funnel steps", () => {
  const steps = stepsOf(doc, row);

  it("works out each step's rate from the one before", () => {
    expect(steps.map((s) => [s.key, s.n, s.conv, s.drop])).toEqual([
      ["leads", 745, null, null],
      ["talked", 512, 69, 233],
      ["info", 238, 46, 274],
      ["offer", 131, 55, 107],
      ["ordered", 94, 72, 37],
      ["paid", 81, 86, 13],
    ]);
  });

  it("skips talked when calls are unknown", () => {
    const s = stepsOf(doc, { ...row, talked: null });
    expect(s[1]).toMatchObject({ n: null, conv: null });
    expect(s[2]).toMatchObject({ conv: 32, drop: 507 }); // 238 / 745
  });

  it("names the biggest leaks", () => {
    expect(leaks(steps)).toEqual([
      { from: "Gaplashildi", to: "Ma'lumot berildi", lost: 274 },
      { from: "Lid keldi", to: "Gaplashildi", lost: 233 },
      { from: "Ma'lumot berildi", to: "Taklif yuborildi", lost: 107 },
    ]);
  });

  it("helpers", () => {
    expect(pct(81, 745)).toBe(10.9);
    expect(pct(1, 0)).toBeNull();
    expect(behind(55, 69)).toBe(true);
    expect(behind(62, 69)).toBe(false);
    expect(prevMonth("2026-01")).toBe("2025-12");
  });
});

describe("loss reasons", () => {
  it("sorts reasons and marks the ones where nobody talked", () => {
    const r = lossReasons({ ...row, lost: 10, loss: { "Нарх қиммат": 3, "Алоқа йўқ": 4, "Хато рақам": 2, "Рақобатчи танланди": 1 } });
    expect(r.map((x) => [x.reason, x.n, x.pct, x.noTalk])).toEqual([
      ["Алоқа йўқ", 4, 40, true],
      ["Нарх қиммат", 3, 30, false],
      ["Хато рақам", 2, 20, true],
      ["Рақобатчи танланди", 1, 10, false],
    ]);
    expect(lossReasons(row)).toEqual([]); // docs written before reasons were kept
  });
});
