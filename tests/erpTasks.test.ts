import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { missedOnMove } from "../src/lib/crmService";
const require = createRequire(import.meta.url);
const E = require("../meta-webhook/erpTasks.js");

const at = (s: string) => Date.parse(`${s}:00+05:00`);
const now = at("2026-11-26T15:00");
const T = (id: string, o: Record<string, unknown>) => ({ id, lead_id: "L1", type: "call", due_date: "2026-11-26", due_time: "11:00", assigned_to_email: "Nur@vp.uz", status: "open", completed_at: null, ...o });
const leads = [
  { id: "L1", status: "accepted", assigned_to_email: "nur@vp.uz", created_at: "2026-11-20T00:00:00Z", full_name: "Ali", estimated_amount: 2_000_000 },
  { id: "L2", status: "new", assigned_to_email: "nur@vp.uz", created_at: "2026-11-20T00:00:00Z", brand: "Oq Non", estimated_amount: 5_000_000, updated_at: "2026-11-20T00:00:00Z" },
  { id: "L3", status: "advance", converted_order_id: "o1", assigned_to_email: "nur@vp.uz", created_at: "2026-11-20T00:00:00Z" },
  { id: "OLD", status: "new", assigned_to_email: "nur@vp.uz", created_at: "2026-10-01T00:00:00Z" },
  { id: "AMO", status: "accepted", amo_id: 5, assigned_to_email: "nur@vp.uz", created_at: "2026-10-01T00:00:00Z", estimated_amount: 1 },
];

describe("ERP tasks → KPI numbers", () => {
  const tasks = [
    T("ontime", { status: "done", completed_at: "2026-11-26T05:30:00Z" }), // 10:30 ≤ 11:00
    T("donelate", { status: "done", completed_at: "2026-11-26T07:00:00Z" }), // 12:00
    T("overdue", {}), // 11:00 passed, open
    T("later", { due_time: "17:00" }), // not due yet: not counted
    T("moved", { due_date: "2026-11-28", missed: "2026-11", missed_at: "2026-11-26T09:00:00Z" }),
    T("oldlead", { lead_id: "OLD" }),
    T("nextmonth", { due_date: "2026-12-02" }),
    T("noone", { assigned_to_email: "" }),
  ];
  const s = E.computeErpTasks("2026-11", { tasks, leads, now }).get("nur@vp.uz");
  it("on time / late like amoCRM", () => {
    expect(s).toMatchObject({ due: 4, on_time: 1, late: 3, pct: 25 });
  });
  it("the state now", () => {
    expect(s).toMatchObject({ overdue_open: 1, today_due: 4, today_open: 2, postponed_today: 1 });
  });
  it("open leads without a task (old ones skipped, amoCRM ones counted)", () => {
    expect(s.no_task_leads).toBe(2);
    expect(s.no_task_list.map((l: { id: string }) => l.id)).toEqual(["L2", "AMO"]);
  });
  it("a move counts late only once its day has come", () => {
    expect(E.missedOnMove({ status: "open", due_date: "2026-11-26" }, "2026-11-27", now)).toMatchObject({ missed: "2026-11" });
    expect(E.missedOnMove({ status: "open", due_date: "2026-11-27" }, "2026-11-28", now)).toEqual({});
    expect(E.missedOnMove({ status: "open", due_date: "2026-11-26" }, "2026-11-26", now)).toEqual({});
    expect(E.missedOnMove({ status: "open", due_date: "2026-11-25", missed: "2026-11" }, "2026-11-27", now)).toEqual({});
    // the app's copy agrees
    expect(missedOnMove({ status: "open", due_date: "2026-11-26" }, "2026-11-27", now)).toMatchObject({ missed: "2026-11" });
    expect(missedOnMove({ status: "open", due_date: "2026-11-27" }, "2026-11-28", now)).toEqual({});
  });
});

describe("ERP daily messages", () => {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  it("09:00", () => {
    const text = E.morningText([T("a", { due_time: "10:00", note: "narx" }), T("b", { due_date: "2026-11-25" }), T("c", { status: "done" })], leadById, { no_task_leads: 1, no_task_list: [{ id: "L2", name: "Oq Non", price: 5_000_000 }] }, at("2026-11-26T09:00"));
    expect(text).toContain("☀️ Bugungi zadachalaringiz: 1 ta"); // the done one is not listed
    expect(text).toContain("• 10:00 Qo'ng'iroq qilish — «Ali» (narx)");
    expect(text).toContain("⚠️ Muddati o'tgan: 1 ta");
    expect(text).toContain("📌 Zadachasiz lidlar: 1 ta");
    expect(text).toContain("lead=L2");
    expect(E.morningText([], leadById, null, now)).toBeNull();
  });
  it("18:00", () => {
    expect(E.eveningText([T("a", { status: "done" })], leadById, now)).toContain("hammasi bajarildi");
    expect(E.eveningText([T("a", {}), T("b", { status: "done" })], leadById, now)).toContain("1 ta (2 tadan)");
  });
  it("10:00 and 15:00", () => {
    const lists = E.dealLists(leads, [T("x", { lead_id: "L1" })], now).get("nur@vp.uz");
    expect(lists.noTask.map((d: { id: string }) => d.id)).toEqual(["L2", "AMO"]);
    expect(lists.stale.map((d: { id: string }) => d.id)).toContain("L2");
    expect(E.dealText("Nuriddin", lists)).toContain("2 ta lidda keyingi zadacha yo'q");
    expect(E.dealText("Nuriddin", lists, true)).toContain("⏰ Nuriddin, hali 2 ta");
    expect(E.dealText("Nuriddin", { noTask: [], stale: [] }, true)).toBeNull();
  });
});
