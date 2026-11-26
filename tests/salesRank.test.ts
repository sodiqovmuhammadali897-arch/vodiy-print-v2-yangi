import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const R = require("../meta-webhook/salesRank.js");

describe("weekly places", () => {
  it("week starts on Monday (Tashkent)", () => {
    expect(R.weekStart(Date.parse("2026-11-26T12:00:00+05:00"))).toBe("2026-11-23");
    expect(R.weekStart(Date.parse("2026-11-23T00:30:00+05:00"))).toBe("2026-11-23");
    expect(R.weekStart(Date.parse("2026-11-29T23:00:00+05:00"))).toBe("2026-11-23");
  });
  it("talk, tasks done and sales, with places", () => {
    const iso = (s: string) => new Date(Date.parse(`${s}:00+05:00`)).toISOString();
    const sellers = [
      { email: "a@vp", name: "Ali", managerName: "Ali" },
      { email: "b@vp", name: "Bek", managerName: "Bek" },
      { email: "c@vp", name: "Can", managerName: "Can" },
    ];
    const calls = [
      { staff_email: "A@vp", answered: true, answer_time: iso("2026-11-24T10:00"), end_time: iso("2026-11-24T10:05"), start_time: iso("2026-11-24T10:00") },
      { staff_email: "b@vp", answered: true, duration_seconds: 120, start_time: iso("2026-11-25T10:00") },
      { staff_email: "b@vp", answered: true, duration_seconds: 999, start_time: iso("2026-11-20T10:00") }, // last week
    ];
    const tasks = [
      { assigned_to_email: "b@vp", status: "done", completed_at: iso("2026-11-24T11:00") },
      { assigned_to_email: "b@vp", status: "done", completed_at: iso("2026-11-25T11:00") },
      { assigned_to_email: "a@vp", status: "done", completed_at: iso("2026-11-21T11:00") },
    ];
    const orders = [
      { manager_name: " ali ", total_amount: 3_000_000, order_date: "2026-11-24" },
      { manager_name: "Bek", total_amount: 5_000_000, created_at: iso("2026-11-25T09:00") },
      { manager_name: "Bek", total_amount: 9_000_000, status: "cancelled", order_date: "2026-11-25" },
      { manager_name: "Can", total_amount: 1, is_draft: true, order_date: "2026-11-25" },
    ];
    const rows = R.weekRank({ sellers, calls, tasks, orders, week: "2026-11-23" });
    const a = rows.find((r: { email: string }) => r.email === "a@vp");
    const b = rows.find((r: { email: string }) => r.email === "b@vp");
    const c = rows.find((r: { email: string }) => r.email === "c@vp");
    expect(a).toMatchObject({ talk_sec: 300, done: 0, sales: 3_000_000, rank: { talk: 1, done: 2, sales: 2 }, of: 3 });
    expect(b).toMatchObject({ talk_sec: 120, done: 2, sales: 5_000_000, rank: { talk: 2, done: 1, sales: 1 } });
    expect(c).toMatchObject({ talk_sec: 0, done: 0, sales: 0, rank: { talk: 3, done: 2, sales: 3 } });
  });
});
