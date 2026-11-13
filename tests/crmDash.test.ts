import { describe, expect, it } from "vitest";
import {
  crmDash,
  managerRows,
  periodSpans,
  talkLabel,
  talkSeconds,
  callHour,
  type CallRow,
} from "../src/lib/crmDash";
import type { Lead, LeadTask } from "../src/lib/types";

const NOW = Date.parse("2026-11-13T09:30:00Z"); // 14:30 Tashkent, Friday
const iso = (s: string) => new Date(Date.parse(s)).toISOString();

const lead = (id: string, p: Partial<Lead>): Lead =>
  ({
    id,
    full_name: id,
    brand: "",
    phone: "",
    source: "Telefon",
    status: "new",
    assigned_to_email: "n@vp.uz",
    created_at: "2026-11-13T04:00:00.000Z",
    updated_at: "",
    converted_order_id: null,
    estimated_amount: 0,
    lost_reason: "",
    ...p,
  }) as Lead;
const task = (id: string, p: Partial<LeadTask>): LeadTask =>
  ({
    id,
    lead_id: "a",
    type: "call",
    due_date: "2026-11-13",
    due_time: "16:00",
    status: "open",
    assigned_to_email: "n@vp.uz",
    completed_at: null,
    ...p,
  }) as LeadTask;
const call = (id: string, p: Partial<CallRow>): CallRow => ({
  id,
  direction: "out",
  answered: true,
  duration_seconds: 60,
  staff_email: "n@vp.uz",
  created_at: "2026-11-13T05:00:00.000Z",
  ...p,
});

describe("CRM home: periods", () => {
  it("today is compared with yesterday until the same hour", () => {
    const { cur, prev } = periodSpans("today", NOW);
    expect(iso(new Date(cur.from).toISOString())).toBe(
      "2026-11-12T19:00:00.000Z",
    );
    expect(cur.to).toBe(NOW);
    expect(prev.to).toBe(NOW - 86400e3);
  });
  it("week starts on Monday, month on the 1st (Tashkent)", () => {
    expect(new Date(periodSpans("week", NOW).cur.from).toISOString()).toBe(
      "2026-11-08T19:00:00.000Z",
    );
    const m = periodSpans("month", NOW);
    expect(new Date(m.cur.from).toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(new Date(m.prev.from).toISOString()).toBe(
      "2026-09-30T19:00:00.000Z",
    );
  });
  it("custom dates include the last day", () => {
    const { cur, prev } = periodSpans("custom", NOW, {
      from: "2026-11-01",
      to: "2026-11-10",
    });
    expect(cur.to - cur.from).toBe(10 * 86400e3);
    expect(prev.to).toBe(cur.from);
  });
});

describe("CRM home: talk time", () => {
  it("counts answer → end, not the ringing", () => {
    expect(
      talkSeconds({
        answered: true,
        answer_time: "2026-11-13T05:00:10Z",
        end_time: "2026-11-13T05:02:00Z",
        duration_seconds: 130,
      }),
    ).toBe(110);
    expect(talkSeconds({ answered: true, duration_seconds: 45 })).toBe(45);
    expect(talkSeconds({ answered: false, duration_seconds: 20 })).toBe(0);
  });
  it("labels", () => {
    expect(talkLabel(40)).toBe("40 s");
    expect(talkLabel(47 * 60)).toBe("47 daq");
    expect(talkLabel(134 * 60)).toBe("2 s 14 d");
    expect(
      callHour({ start_time: "2026-11-13T05:10:00Z", created_at: "" }),
    ).toBe(10);
  });
});

describe("CRM home: numbers", () => {
  const { cur, prev } = periodSpans("today", NOW);
  const leads = [
    lead("a", {}),
    lead("b", { status: "accepted" }), // no task
    lead("c", {
      status: "lost",
      lost_reason: "Narx qimmat",
      updated_at: "2026-11-13T06:00:00.000Z",
    }),
    lead("d", { converted_order_id: "o1", status: "advance" }),
    lead("e", { assigned_to_email: "m@vp.uz", source: "Sayt" }),
    lead("old", { created_at: "2026-06-01T00:00:00.000Z" }), // first version, hidden
    lead("y", { created_at: "2026-11-12T05:00:00.000Z", status: "offer" }), // yesterday
  ];
  const tasks = [
    task("t1", { due_time: "10:00" }), // late
    task("t2", {}), // today
    task("t3", { status: "done", completed_at: "2026-11-13T06:00:00.000Z" }),
    task("t4", { lead_id: "y", due_date: "2026-11-15" }),
    task("t5", { lead_id: "old", due_date: "2026-11-01" }), // on an old lead: ignored
  ];
  const calls = [
    call("c1", { answered: true, duration_seconds: 120 }),
    call("c2", { direction: "in", answered: false, duration_seconds: 0 }),
    call("c3", { staff_email: "m@vp.uz", duration_seconds: 20 }),
    call("c4", { created_at: "2026-11-12T05:00:00.000Z" }), // yesterday
  ];
  const orders = {
    o1: {
      status: "new" as const,
      total_amount: 2_000_000,
      created_at: "2026-11-13T07:00:00.000Z",
    },
  };

  it("everyone", () => {
    const d = crmDash({
      leads,
      tasks,
      calls,
      orders,
      owner: "",
      cur,
      prev,
      now: NOW,
    });
    expect(d.lateTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(d.todayTasks.map((t) => t.id)).toEqual(["t2"]);
    expect(d.doneTasks.length).toBe(1);
    expect(d.noTaskLeads.map((l) => l.id)).toEqual(["b", "e"]);
    expect(d.newLeads.length).toBe(5);
    expect(d.newDelta).toBe(4);
    expect(d.calls.length).toBe(3);
    expect(d.missed).toBe(1);
    expect(d.talk).toBe(140);
    expect(d.talks).toBe(1);
    expect(d.won.map((l) => l.id)).toEqual(["d"]);
    expect(d.wonSum).toBe(2_000_000);
    expect(d.lostReasons).toEqual([{ label: "Narx qimmat", n: 1 }]);
    expect(d.sources).toEqual([
      { label: "Telefon", n: 4 },
      { label: "Sayt", n: 1 },
    ]);
    expect(d.funnel.find((f) => f.key === "new")?.n).toBe(2);
    expect(d.hours[10]).toBe(3);
  });

  it("one manager, and the managers table", () => {
    const d = crmDash({
      leads,
      tasks,
      calls,
      orders,
      owner: "m@vp.uz",
      cur,
      prev,
      now: NOW,
    });
    expect(d.newLeads.length).toBe(1);
    expect(d.calls.length).toBe(1);
    expect(d.lateTasks.length).toBe(0);
    const rows = managerRows([{ email: "n@vp.uz", name: "Nuriddin" }], {
      leads,
      tasks,
      calls,
      orders,
      cur,
      prev,
      now: NOW,
    });
    expect(rows[0]).toMatchObject({
      newLeads: 4,
      calls: 2,
      talk: 120,
      done: 1,
      late: 1,
      noTask: 1,
      open: 3,
    });
  });
});
