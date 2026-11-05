import { describe, expect, it } from "vitest";
import { monthTrend, periodDays, summarize, type LostDay, type LostItem } from "../src/lib/lost";

const item = (id: number, user: number, group: LostItem["group"], price = 0, reason = ""): LostItem => ({ id, name: `#${id}`, price, user, manager: user === 1 ? "Nuriddin" : "Maryam", reason, group, stage: "", closed: "2026-11-05T10:00:00.000Z" });
const day = (d: string, items: LostItem[]): LostDay => ({ id: d, day: d, total: items.length, sum: 0, counts: items.reduce((c, it) => ({ ...c, [it.group]: (c[it.group as keyof typeof c] || 0) + 1 }), {} as Record<string, number>), items });

const days = [
  day("2026-10-30", [item(1, 1, "price", 1e6, "Нарх қиммат")]),
  day("2026-11-04", [item(2, 2, "competitor", 2e6, "Рақобатчи танланди")]),
  day("2026-11-05", [item(3, 1, "price", 3e6, "Нарх қиммат"), item(4, 1, "no_answer", 0, "Алоқа йўқ"), item(5, 2, "other", 0, "Тахи")]),
];

describe("Yutqazilganlar (page)", () => {
  it("knows the days of each period", () => {
    expect(periodDays("today", "2026-11-05")).toEqual({ from: "2026-11-05", to: "2026-11-05" });
    expect(periodDays("yesterday", "2026-11-01")).toEqual({ from: "2026-10-31", to: "2026-10-31" });
    expect(periodDays("week", "2026-11-05")).toEqual({ from: "2026-10-30", to: "2026-11-05" });
    expect(periodDays("month", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-05" });
  });

  it("sums a period by reason and manager", () => {
    const s = summarize(days, "2026-11-01", "2026-11-05");
    expect(s.total).toBe(4);
    expect(s.sum).toBe(5e6);
    expect(s.byGroup.price).toEqual({ n: 1, sum: 3e6 });
    expect(s.byGroup.competitor).toEqual({ n: 1, sum: 2e6 });
    expect(s.managers.map((m) => [m.name, m.n])).toEqual([["Nuriddin", 2], ["Maryam", 2]]);
    expect(s.items[0].id).toBe(3); // biggest sum first
    expect(s.reasons.find((r) => r.reason === "Тахи")).toMatchObject({ group: "other", n: 1 });
    expect(summarize(days, "2026-11-01", "2026-11-05", 2).total).toBe(2);
  });

  it("gives the month trend", () => {
    expect(monthTrend(days)).toEqual([
      { month: "2026-10", total: 1, price: 1, competitor: 0 },
      { month: "2026-11", total: 4, price: 1, competitor: 1 },
    ]);
  });
});
