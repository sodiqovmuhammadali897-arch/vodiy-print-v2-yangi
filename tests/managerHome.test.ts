import { describe, expect, it } from "vitest";
import { monthConversion, planLine, talkProgress, workDaysLeft } from "../src/lib/managerHome";
import type { Lead } from "../src/lib/types";

const now = Date.parse("2026-11-26T12:00:00+05:00"); // Thursday

describe("manager home", () => {
  it("working days left (today included, Sundays off)", () => {
    expect(workDaysLeft(now)).toBe(4); // 26, 27, 28, 30 (29 is Sunday)
    expect(workDaysLeft(now, ["2026-11-27"])).toBe(3);
  });
  it("plan", () => {
    expect(planLine(60_000_000, 38_400_000, 4)).toEqual({ plan: 60_000_000, sales: 38_400_000, pct: 64, left: 21_600_000, perDay: 5_400_000 });
    expect(planLine(0, 5, 4)).toMatchObject({ pct: null, perDay: 0 });
    expect(planLine(10, 20, 4)).toMatchObject({ left: 0, pct: 200 });
  });
  it("conversion, own and the team's", () => {
    const L = (id: string, email: string, order?: string, created = "2026-11-20T05:00:00Z") => ({ id, assigned_to_email: email, converted_order_id: order || null, created_at: created, status: "accepted" }) as unknown as Lead;
    const leads = [L("1", "me", "o1"), L("2", "me"), L("3", "me", "o2"), L("4", "x", "o3"), L("5", "x"), L("6", "me", "o1", "2026-10-02T00:00:00Z")];
    const orders = { o1: { status: "production" }, o2: { status: "cancelled" }, o3: { status: "closed" } } as never;
    expect(monthConversion(leads, orders, "me", now)).toEqual({ leads: 3, won: 1, conv: 1 / 3, team: 2 / 5 });
  });
  it("talk vs target", () => {
    expect(talkProgress(47 * 60, 60)).toEqual({ min: 47, target: 60, pct: 78 });
    expect(talkProgress(90 * 60, 60).pct).toBe(100);
  });
});
