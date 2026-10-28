import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const D = require("../meta-webhook/amoDeals");

const now = Date.parse("2026-11-02T10:00:00+05:00");
const day = 86400000;
const lead = (id: number, extra: Record<string, unknown> = {}) => ({ id, user: 7, status: 100, name: `Bitim ${id}`, price: id * 1_000_000, updated: now - day, ...extra });

describe("bitim nazorati", () => {
  const leads = [
    lead(1), // has a task
    lead(2), // no task
    lead(3, { updated: now - 5 * day }), // no task, untouched 5 days
    lead(4, { status: 142 }), // won: not open
    lead(5, { user: 8, updated: now - 4 * day }), // other manager, has a task, stale
  ];
  const tasks = [
    { entity: "leads", entityId: 1, done: false },
    { entity: "leads", entityId: 5, done: false },
    { entity: "leads", entityId: 2, done: true }, // done task does not count
  ];
  const by = D.dealLists(leads, tasks, now, () => "Muzokara");

  it("lists open deals without a task and untouched ones, per manager", () => {
    expect(by.get(7).noTask.map((d: { id: number }) => d.id)).toEqual([3, 2]);
    expect(by.get(7).stale.map((d: { id: number }) => d.id)).toEqual([3]);
    expect(by.get(8).noTask).toEqual([]);
    expect(by.get(8).stale[0].idle).toBe(4);
  });

  it("writes the manager's messages", () => {
    const t = D.managerText("Maryam", by.get(7));
    expect(t).toContain("Maryam, 2 ta bitimda keyingi vazifa yo'q:");
    expect(t).toContain("• Bitim 3 — 3 mln · Muzokara");
    expect(t).toContain("3 kundan beri harakatsiz — 1 ta:");
    expect(t).toContain("· 5 kun");
    expect(D.managerText("Maryam", by.get(7), true)).toContain("hali 2 ta bitimda");
    expect(D.managerText("X", { noTask: [], stale: [] })).toBeNull();
    expect(D.managerText("X", { noTask: [], stale: by.get(8).stale }, true)).toBeNull();
  });

  it("tells the admins about a lost deal with no reason", () => {
    const lost = [lead(9, { status: 143, closed: now - 3600000, loss: null }), lead(10, { status: 143, closed: now, loss: "Qimmat" })];
    expect(D.lostNoReason(lost, "2026-11-02").map((l: { id: number }) => l.id)).toEqual([9]);
    expect(D.lostText(lost[0], "Maryam")).toContain("Bitim 9 — 9 mln · Maryam");
  });
});
