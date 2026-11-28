import { describe, expect, it } from "vitest";
import { boardCounts, cardDate, passes, rowFlags } from "../src/lib/boardFilters";

// 2026-11-28 12:00 Tashkent
const now = Date.parse("2026-11-28T12:00:00+05:00");

describe("Jarayon top strip — counts leads, each number filters the board", () => {
  const rows = [
    { created_at: "2026-11-28T06:00:00Z", col: "new" as const, next: { due_date: "2026-11-28", due_time: "15:00" } }, // today, new today
    { created_at: "2026-11-27T10:00:00Z", col: "accepted" as const, next: { due_date: "2026-11-25", due_time: "10:00" } }, // late, new yesterday
    { created_at: "2026-11-20T10:00:00Z", col: "offer" as const, next: null }, // no task
    { created_at: "2026-11-20T10:00:00Z", col: "advance" as const, next: null }, // order stage: no task needed
    { created_at: "2026-11-20T10:00:00Z", col: "info_given" as const, next: { due_date: "2026-11-28", due_time: "09:00" } }, // today's time passed → late
  ];
  it("counts", () => {
    expect(boardCounts(rows, now)).toEqual({ today: 1, late: 2, notask: 1, newToday: 1, newYesterday: 1 });
  });
  it("filters match the counts", () => {
    expect(rows.filter((r) => passes("late", r, now)).length).toBe(2);
    expect(rows.filter((r) => passes("today", r, now)).length).toBe(1);
    expect(rows.filter((r) => passes("notask", r, now)).length).toBe(1);
    expect(rows.filter((r) => passes("new", r, now)).length).toBe(2);
    expect(rows.filter((r) => passes("", r, now)).length).toBe(5);
  });
  it("flags", () => {
    expect(rowFlags(rows[2], now).notask).toBe(true);
    expect(rowFlags(rows[3], now).notask).toBe(false);
  });
});

describe("cardDate", () => {
  it("today, yesterday, this year, older", () => {
    expect(cardDate("2026-11-28T07:22:00Z", now)).toBe("Bugun 12:22");
    expect(cardDate("2026-11-27T14:10:00Z", now)).toBe("Kecha 19:10");
    expect(cardDate("2026-11-20T10:00:00Z", now)).toBe("20.11");
    expect(cardDate("2025-12-02T10:00:00Z", now)).toBe("02.12.2025");
    expect(cardDate("", now)).toBe("");
  });
});
