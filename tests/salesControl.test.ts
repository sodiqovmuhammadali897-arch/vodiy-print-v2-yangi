import { describe, expect, it } from "vitest";
import { attention, buildRows, monthShare } from "../src/lib/salesControl";
import type { AmoStat } from "../src/lib/amoStats";
import type { AmoTaskDoc } from "../src/lib/salesKpi";
import type { Manager, Order } from "../src/lib/types";

const today = "2026-11-22";
const stat = (email: string, extra: Partial<AmoStat> = {}) =>
  ({
    month: "2026-11",
    amo_user_id: 1,
    name: email,
    staff_email: email,
    leads: { created: 0, won: 0, lost: 0, won_amount: 0, open: 14, stale: 3 },
    today: { day: today, total: 21, answered: 15, talk_sec: 2280, talked: 12, first: "10:14", last: "16:20", missed_open: [1, 2, 3].map((i) => ({ at: "11:0" + i, phone: "", lead_id: null, lead_name: "", waiting_min: 30 })) },
    ...extra,
  }) as unknown as AmoStat;
const task = (email: string, extra: Partial<AmoTaskDoc> = {}) => ({ month: "2026-11", amo_user_id: 1, staff_email: email, today_due: 8, today_open: 3, overdue_open: 1, no_task_leads: 4, ...extra }) as unknown as AmoTaskDoc;
const order = (id: string, manager_id: string, order_date: string, total: number, extra: Partial<Order> = {}) => ({ id, manager_id, order_date, total_amount: total, remaining_amount: 0, status: "closed", order_number: id, title: "Paket", ...extra }) as unknown as Order;

describe("salesControl", () => {
  const managers = [{ id: "m1", name: "Maryam", monthly_plan: 200_000_000 }] as Manager[];
  const staff = [{ id: "maryam@vp.uz", full_name: "Maryam", report_manager_id: "m1" }];
  const orders = [
    order("a", "m1", "2026-11-03", 50_000_000),
    order("b", "m1", "2026-11-22", 12_000_000),
    order("c", "m1", "2026-10-30", 30_000_000, { remaining_amount: 5_000_000, status: "delivered" }),
    order("d", "m1", "2026-11-10", 20_000_000, { status: "cancelled" }),
  ];
  const rows = buildRows({ staff, managers, stats: [stat("maryam@vp.uz")], tasks: [task("maryam@vp.uz")], orders, recall: [], today, nowHm: "16:40" });
  const r = rows[0];

  it("adds up the month against the plan and forecasts the month end", () => {
    expect(r.name).toBe("Maryam");
    expect(r.monthSales).toBe(62_000_000);
    expect(r.todaySales).toBe(12_000_000);
    expect(Math.round(r.pct!)).toBe(31);
    expect(Math.round(r.forecast! / 1e6)).toBe(Math.round(62 / monthShare(today)));
  });

  it("flags what is past the limits", () => {
    expect(r.flags.first).toBe("bad"); // 10:14
    expect(r.flags.missed).toBe("bad"); // 3 > 2
    expect(r.flags.noTask).toBe("bad"); // 4 > 1
    expect(r.flags.stale).toBe("bad"); // 3 > 2
    expect(r.flags.plan).toBe("bad"); // 31% while the month is 73% through
    expect(r.flags.debt).toBe("bad"); // delivered 23 days ago, unpaid
    expect(r.debtSum).toBe(5_000_000);
  });

  it("writes the attention line", () => {
    expect(attention(rows)).toEqual([{ name: "Maryam", text: "birinchi qo'ng'iroq 10:14, 3 javobsiz, 4 vazifasiz bitim, 3 harakatsiz bitim, reja 31%, eski qarz" }]);
  });

  it("shows nothing red for a clean day", () => {
    const clean = buildRows({
      staff,
      managers,
      stats: [stat("maryam@vp.uz", { leads: { created: 0, won: 0, lost: 0, won_amount: 0, open: 5, stale: 0 }, today: { day: today, total: 30, answered: 20, talk_sec: 3000, talked: 15, first: "09:05", last: "16:00", missed_open: [] } } as Partial<AmoStat>)],
      tasks: [task("maryam@vp.uz", { no_task_leads: 0, overdue_open: 0 })],
      orders: [order("a", "m1", "2026-11-03", 160_000_000)],
      recall: [],
      today,
      nowHm: "16:40",
    })[0];
    expect(Object.values(clean.flags).filter(Boolean)).toEqual([]);
  });
});
