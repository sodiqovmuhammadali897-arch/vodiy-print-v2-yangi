import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SP = require("../meta-webhook/adsSpend.js");

const row = (ad: string, spend: number, leads = 0, extra = {}) => ({
  campaign_id: "c1", campaign_name: "Giftbox", adset_id: "s1", adset_name: "Vodiy", ad_id: ad, ad_name: `Video ${ad}`,
  spend: String(spend), impressions: "1000", clicks: "10", inline_link_clicks: "5",
  actions: leads ? [{ action_type: "lead", value: String(leads) }, { action_type: "leadgen_grouped", value: String(leads) }] : [],
  ...extra,
});

describe("buildDay", () => {
  it("converts each day with that day's rate and never sums lead counters", () => {
    const d = SP.buildDay({ day: "2026-11-24", rate: 12002.93, rows: [row("a1", 3.8, 2), row("a2", 0.15)], account: { reach: "10398", impressions: "12997" } });
    expect(d.totals.usd).toBe(3.95);
    expect(d.totals.spend).toBe(Math.round(3.95 * 12002.93));
    expect(d.totals.leads).toBe(2);
    expect(d.totals.reach).toBe(10398);
    expect(d.ads[0].a).toBe("a1");
  });
  it("the same answer twice gives the same day, not double", () => {
    const rows = [row("a1", 3.8, 2)];
    const one = SP.buildDay({ day: "d", rate: 12000, rows });
    const two = SP.buildDay({ day: "d", rate: 12000, rows });
    expect(two.totals).toEqual(one.totals);
  });
  it("counts ERP leads, also for ads with no Meta row", () => {
    const d = SP.buildDay({ day: "d", rate: 12000, rows: [row("a1", 1)], erpByAd: { a1: 2, old: 1 } });
    expect(d.ads[0].erp).toBe(2);
    expect(d.totals.erp).toBe(3);
  });
  it("placements", () => {
    const d = SP.buildDay({ day: "d", rate: 10000, rows: [], placements: [{ publisher_platform: "instagram", platform_position: "instagram_reels", spend: "2", impressions: "500" }, { publisher_platform: "unknown", platform_position: "unknown", spend: "0", impressions: "0" }] });
    expect(d.placements).toEqual([{ plat: "instagram", pos: "instagram_reels", usd: 2, spend: 20000, impr: 500, clicks: 0, leads: 0, chats: 0 }]);
  });
});

describe("usage and limits", () => {
  it("reads Meta's usage header", () => {
    const h = new Map([["x-business-use-case-usage", JSON.stringify({ "123": [{ type: "ads_insights", call_count: 37, total_cputime: 5, total_time: 9 }] })]]);
    expect(SP.usagePct(h)).toBe(37);
    expect(SP.usagePct(new Map())).toBe(0);
  });
  it("month over the limit → red line with the real percent", () => {
    const a = SP.limitAlerts({ today: 100000, month: 6866304, activeDaily: 384000, dailyLimit: 200000, monthlyLimit: 6000000, daysLeft: 6, rate: 12002.93 });
    expect(a.map((x: { key: string }) => x.key)).toEqual(["month_over", "budget_over", "_rate"]);
    expect(a[0].text).toContain("114,4%");
  });
  it("forecast only when not over yet", () => {
    const a = SP.limitAlerts({ today: 100000, month: 5000000, activeDaily: 384000, dailyLimit: 400000, monthlyLimit: 6000000, daysLeft: 6, rate: 0 });
    expect(a.map((x: { key: string }) => x.key)).toEqual(["month_forecast"]);
    expect(SP.limitAlerts({ today: 1, month: 1, activeDaily: 1, dailyLimit: 200000, monthlyLimit: 6000000, daysLeft: 6, rate: 1 })).toEqual([]);
  });
});
