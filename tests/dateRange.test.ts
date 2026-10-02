import { describe, expect, it } from "vitest";
import { presetRange, previousPeriod } from "../src/lib/dateRange";

describe("presetRange", () => {
  // 2 Oct 2026, 10:00 in Tashkent.
  const now = new Date("2026-10-02T05:00:00Z");

  it("gives last month as whole days", () => {
    expect(presetRange("prev_month", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("prev_month", new Date("2026-03-10T05:00:00Z"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetRange("prev_month", new Date("2027-01-15T05:00:00Z"))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("starts this month on the 1st", () => {
    expect(presetRange("month", now)).toEqual({ from: "2026-10-01", to: "2026-10-02" });
    expect(presetRange("year", now)).toEqual({ from: "2026-01-01", to: "2026-10-02" });
  });

  it("uses the Tashkent day just after midnight", () => {
    // 1 Nov 2026 00:30 in Tashkent is still 31 Oct in UTC.
    const early = new Date("2026-10-31T19:30:00Z");
    expect(presetRange("today", early)).toEqual({ from: "2026-11-01", to: "2026-11-01" });
    expect(presetRange("prev_month", early)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("starts the week on Monday", () => {
    expect(presetRange("week", now)).toEqual({ from: "2026-09-28", to: "2026-10-02" });
  });
});

describe("previousPeriod", () => {
  it("compares last month with the whole month before it", () => {
    expect(previousPeriod({ preset: "prev_month", from: "2026-09-01", to: "2026-09-30" })).toEqual({ preset: "custom", from: "2026-08-01", to: "2026-08-31" });
    expect(previousPeriod({ preset: "prev_month", from: "2026-01-01", to: "2026-01-31" })).toEqual({ preset: "custom", from: "2025-12-01", to: "2025-12-31" });
  });
});
