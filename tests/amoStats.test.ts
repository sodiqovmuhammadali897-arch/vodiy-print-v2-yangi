import { describe, expect, it } from "vitest";
import { conversion, formatAvgCall, formatTalk, funnelRows, minutesSince, sumStats, type AmoStat } from "../src/lib/amoStats";

const stat = (user: number, extra: Partial<AmoStat> = {}): AmoStat => ({
  id: `2026-10_${user}`,
  month: "2026-10",
  amo_user_id: user,
  name: `U${user}`,
  staff_email: null,
  leads: { created: 10, won: 2, lost: 3, won_amount: 1_000_000, open: 5, stale: 1 },
  calls: { total: 20, answered: 15, talk_sec: 3000, in: 5, out: 15, talked: 9 },
  today: null,
  funnel: { "7:10": 2, "7:11": 3 },
  sources: { Instagram: 6, Telegram: 4 },
  loss: { "Narx qimmat": 3 },
  daily: { "2026-10-01": { leads: 4, calls: 8, talk_sec: 900 } },
  ...extra,
});

describe("amoCRM stats", () => {
  it("adds managers up", () => {
    const t = sumStats([stat(2), stat(3, { funnel: { "7:10": 1 } })]);
    expect(t.leads).toMatchObject({ created: 20, won: 4, open: 10 });
    expect(t.calls.talk_sec).toBe(6000);
    expect(t.funnel).toEqual({ "7:10": 3, "7:11": 3 });
    expect(t.daily["2026-10-01"].leads).toBe(8);
  });
  it("orders the funnel by stage and names it", () => {
    const statuses = { "7:10": { name: "Yangi", pipeline: "Sotuv", pipeline_sort: 1, sort: 10, color: null }, "7:11": { name: "Narx", pipeline: "Sotuv", pipeline_sort: 1, sort: 20, color: null } };
    expect(funnelRows({ "7:11": 3, "7:10": 2 }, statuses).map((r) => r.label)).toEqual(["Yangi", "Narx"]);
    expect(funnelRows({ "9:1": 1 }, statuses)[0].label).toBe("Bosqich 1");
  });
  it("formats talk time and rates", () => {
    expect(formatTalk(45)).toBe("45 sek");
    expect(formatTalk(58 * 60)).toBe("58 daq");
    expect(formatTalk(102 * 60)).toBe("1 soat 42 daq");
    expect(formatAvgCall(234, 1)).toBe("3 daq 54 sek");
    expect(formatAvgCall(0, 0)).toBe("—");
    expect(conversion(2, 10)).toBe(20);
    expect(conversion(1, 0)).toBeNull();
    expect(minutesSince("11:48", new Date("2026-10-01T07:00:00Z"))).toBe(12); // 12:00 Tashkent
  });
});
