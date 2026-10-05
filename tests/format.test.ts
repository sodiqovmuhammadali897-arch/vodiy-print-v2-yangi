import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/lib/format";

describe("dates", () => {
  it("writes day.month.year", () => {
    expect(formatDate("2026-10-05")).toBe("05.10.2026");
    expect(formatDate(new Date(2026, 10, 4, 15, 30).toISOString())).toBe("04.11.2026");
    expect(formatDateTime(new Date(2026, 0, 9, 7, 5).toISOString())).toBe("09.01.2026 07:05");
  });
  it("shows a dash for nothing or junk", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("nonsense")).toBe("-");
    expect(formatDateTime("")).toBe("-");
  });
});
