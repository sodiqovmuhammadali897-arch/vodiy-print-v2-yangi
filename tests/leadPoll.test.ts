import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const P = require("../meta-webhook/leadPoll");

describe("form leads by reading the forms", () => {
  it("reads Meta's time", () => {
    expect(P.unix("2026-11-13T18:21:38+0000")).toBe(Date.parse("2026-11-13T18:21:38Z") / 1000);
  });
  it("moves on to the newest lead, a little back", () => {
    const since = P.unix("2026-11-13T18:00:00+0000");
    expect(P.nextSince([], since)).toBe(since);
    expect(P.nextSince([{ created_time: "2026-11-13T18:21:38+0000" }, { created_time: "2026-11-13T18:06:48+0000" }], since)).toBe(P.unix("2026-11-13T18:21:38+0000") - 120);
    expect(P.nextSince([{ created_time: "2026-11-13T18:01:00+0000" }], since)).toBe(since); // never back before since
  });
  it("asks only for leads after the last check", () => {
    const p = P.leadsPath("123", 1763057000);
    expect(p.startsWith("123/leads?fields=")).toBe(true);
    expect(decodeURIComponent(p)).toContain('"field":"time_created","operator":"GREATER_THAN","value":1763057000');
  });
});
