import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { planSwitch, cutoffOf } = require("../meta-webhook/switchover.js");

const cutoff = cutoffOf("2026-11-25");
const L = (id: string, extra: any = {}) => ({ id, status: "accepted", phone: "", created_at: "2026-11-20T05:00:00Z", converted_order_id: null, ...extra });
const deal = (id: number, phone: string, open = true) => ({ deal: { id }, open, stageName: "Қабул Қилинди", lead: { full_name: `D${id}`, phone, status: "accepted", amo_id: id, assigned_to_email: "", assigned_to_name: "" } });
const task = (id: number, dealId: number, who = 13825110) => ({ id, entity_type: "leads", entity_id: dealId, responsible_user_id: who, complete_till: 1764000000, text: "Связаться" });

describe("switchover plan", () => {
  it("cut-off is the day's start in Tashkent", () => {
    expect(cutoffOf("2026-11-25")).toBe("2026-11-24T19:00:00.000Z");
    expect(cutoffOf("")).toBe("2026-11-24T19:00:00.000Z");
  });

  it("moves tasks onto the deal's lead, makes missing ones, closes the other old leads", () => {
    const leads = [
      L("a", { amo_id: 1 }), // has the deal → keeps, gets the task
      L("b", { phone: "+998901112233", created_at: "2026-11-20T05:00:00Z", amo_id: 7 }), // same phone as deal 2 → linked
      L("c"), // old, no task → closed
      L("d", { created_at: "2026-11-25T03:00:00Z" }), // new → stays
      L("e", { converted_order_id: "o1" }), // has an order → stays
      L("f", { status: "lost" }), // already lost → untouched
      L("g", { amo_id: 4, status: "lost" }), // lost, but its deal has a task → reopened
    ];
    const deals = new Map([
      [1, deal(1, "")],
      [2, deal(2, "901112233")],
      [3, deal(3, "909999999")],
      [4, deal(4, "")],
      [5, deal(5, "", false)],
    ]);
    const erpTasks = [
      { id: "t1", lead_id: "c", status: "open" },
      { id: "t2", lead_id: "c", status: "done" },
      { id: "t3", lead_id: "a", status: "open", amo_task_id: 100 },
    ];
    const amoTasks = [task(100, 1), task(101, 1), task(102, 2), task(103, 3), task(104, 3), task(105, 4), task(106, 5), { ...task(107, 9), entity_type: "contacts" }];
    const p = planSwitch({ leads, erpTasks, amoTasks, deals, cutoff });
    expect(p.already).toBe(1);
    expect(p.tasks.map((x: any) => [x.task.id, x.lead.id])).toEqual([[101, "a"], [102, "b"], [103, "new:3"], [104, "new:3"], [105, "g"]]);
    expect(p.create.map((x: any) => x.dealId)).toEqual([3]);
    expect([...p.link.keys()]).toEqual(["a", "b", "g"]);
    expect([...p.reopen]).toEqual(["g"]);
    expect([p.closedDeal, p.onContacts]).toEqual([1, 1]);
    expect(p.close.map((l: any) => l.id)).toEqual(["c"]);
    expect(p.cancel.map((t: any) => t.id)).toEqual(["t1"]);
    expect(p.keepNew).toBe(1);
  });
});

describe("switchover after the first amoCRM import", () => {
  it("a task the first import copied (same lead, day, time) is not doubled", () => {
    const leads = [L("a", { amo_id: 1 })];
    const deals = new Map([[1, deal(1, "")]]);
    const d = new Date(1764000000 * 1000 + 5 * 3600e3).toISOString();
    const erpTasks = [{ id: "t", lead_id: "a", status: "open", due_date: d.slice(0, 10), due_time: d.slice(11, 16) }];
    const p = planSwitch({ leads, erpTasks, amoTasks: [task(100, 1)], deals, cutoff });
    expect([p.already, p.tasks.length, p.close.length]).toEqual([1, 0, 0]);
  });
});
