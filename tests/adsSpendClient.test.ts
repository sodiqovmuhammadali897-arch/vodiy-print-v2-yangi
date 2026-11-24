import { describe, expect, it } from "vitest";
import { aggregate, metrics, periodSpan, placeLabel, type AdsDay } from "../src/lib/adsSpend";

const ad = (c: string, s: string, a: string, spend: number, leads = 0, erp = 0) => ({ c, cn: `C${c}`, s, sn: `S${s}`, a, an: `A${a}`, usd: spend / 12000, spend, impr: 1000, clicks: 20, link: 10, leads, chats: 0, erp });
const day = (d: string, ads: ReturnType<typeof ad>[], extra: Partial<AdsDay> = {}): AdsDay => ({
  day: d, rate: 12000, ads,
  totals: { usd: 0, spend: ads.reduce((x, y) => x + y.spend, 0), impr: 0, clicks: 0, link: 0, leads: 0, chats: 0, erp: ads.reduce((x, y) => x + y.erp, 0), results: 0 },
  ...extra,
});

describe("aggregate", () => {
  const days = [
    day("2026-11-23", [ad("1", "a", "x", 100000, 2, 1), ad("2", "b", "y", 50000)]),
    day("2026-11-24", [ad("1", "a", "x", 60000, 1), ad("1", "c", "z", 40000, 0)], { totals: { usd: 0, spend: 100000, impr: 0, clicks: 0, link: 0, leads: 0, chats: 0, erp: 2, results: 0, reach: 900 } }),
  ];
  it("sums a period into campaign → ad set → ad, biggest first", () => {
    const g = aggregate(days, "2026-11-23", "2026-11-24");
    expect(g.totals.spend).toBe(250000);
    expect(g.tree.map((c) => c.id)).toEqual(["1", "2"]);
    expect(g.tree[0].spend).toBe(200000);
    expect(g.tree[0].children.map((s) => s.id)).toEqual(["a", "c"]);
    expect(g.tree[0].children[0].children[0].spend).toBe(160000);
    expect(g.totals.erp).toBe(3); // 1 on a row + 2 on the day without a row
    expect(g.reach).toBeNull();
  });
  it("one day keeps the account reach", () => {
    expect(aggregate(days, "2026-11-24", "2026-11-24").reach).toBe(900);
  });
  it("ratios from sums", () => {
    const m = metrics({ usd: 0, spend: 300000, impr: 20000, clicks: 400, link: 200, leads: 10, chats: 2, erp: 0 });
    expect(m).toEqual({ results: 12, cpl: 25000, cpm: 15000, ctr: 1, cpc: 1500 });
    expect(metrics({ usd: 0, spend: 0, impr: 0, clicks: 0, link: 0, leads: 0, chats: 0, erp: 0 }).cpl).toBeNull();
  });
  it("periods and labels", () => {
    expect(periodSpan("d7", "2026-11-24")).toEqual({ from: "2026-11-18", to: "2026-11-24" });
    expect(periodSpan("month", "2026-11-24")).toEqual({ from: "2026-11-01", to: "2026-11-24" });
    expect(periodSpan("custom", "2026-11-24", { from: "2026-11-20", to: "2026-11-10" })).toEqual({ from: "2026-11-10", to: "2026-11-20" });
    expect(placeLabel({ plat: "instagram", pos: "instagram_reels" })).toBe("Instagram · Reels");
    expect(placeLabel({ plat: "facebook", pos: "feed" })).toBe("Facebook · Lenta");
  });
});
