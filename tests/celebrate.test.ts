import { describe, expect, it } from "vitest";
import { firstName, isFresh, kpiBonus, shouldCelebrate } from "../src/lib/celebrate";

describe("«Yangi buyurtma» celebration", () => {
  it("the KPI part is total × rate %, whole so'm", () => {
    expect(kpiBonus(4_200_000, 7.5)).toBe(315_000);
    expect(kpiBonus(4_200_000, 7)).toBe(294_000);
    expect(kpiBonus(1_234_567, 7.5)).toBe(92_593);
    expect(kpiBonus(-5, 7.5)).toBe(0);
  });
  it("only a new real order, or a draft made real, with a sum", () => {
    expect(shouldCelebrate({ asDraft: false, isNew: true, wasDraft: false, total: 100 })).toBe(true);
    expect(shouldCelebrate({ asDraft: false, isNew: false, wasDraft: true, total: 100 })).toBe(true);
    expect(shouldCelebrate({ asDraft: true, isNew: true, wasDraft: false, total: 100 })).toBe(false);
    expect(shouldCelebrate({ asDraft: false, isNew: false, wasDraft: false, total: 100 })).toBe(false);
    expect(shouldCelebrate({ asDraft: false, isNew: true, wasDraft: false, total: 0 })).toBe(false);
  });
  it("first name and fresh toasts", () => {
    expect(firstName("  Muhammaddiyor Abdullayev ")).toBe("Muhammaddiyor");
    expect(isFresh({ created_at: "2026-11-27T05:00:01Z" }, "2026-11-27T05:00:00Z")).toBe(true);
    expect(isFresh({ created_at: "2026-11-27T04:59:59Z" }, "2026-11-27T05:00:00Z")).toBe(false);
  });
});
