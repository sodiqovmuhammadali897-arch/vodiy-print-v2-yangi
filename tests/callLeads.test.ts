import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const C = require("../meta-webhook/callLeads");

describe("calls → ERP leads", () => {
  const leads = [
    { id: "old", phone: "+998 90 123 45 67", status: "new", created_at: "2026-06-01T00:00:00Z" },
    { id: "lost", phone: "998901234567", status: "lost", created_at: "2026-11-12T05:00:00Z" },
    { id: "won", phone: "901234567", status: "advance", created_at: "2026-11-12T06:00:00Z", converted_order_id: "o1" },
    { id: "open", phone: "+998901234567", status: "accepted", created_at: "2026-11-12T04:00:00Z" },
    { id: "other", phone: "+998911112233", status: "new", created_at: "2026-11-13T04:00:00Z" },
  ];
  it("puts a call on the caller's open lead", () => {
    expect(C.pickOpenLead(leads, "90 123 45 67", { o1: "production" })?.id).toBe("won"); // newest open
    expect(C.pickOpenLead(leads, "90 123 45 67", { o1: "closed" })?.id).toBe("open");
    expect(C.pickOpenLead(leads.filter((l) => l.id !== "open"), "+998901234567", { o1: "delivered" })).toBeNull();
    expect(C.pickOpenLead(leads, "123")).toBeNull();
  });
  it("finds the employee's account in the event", () => {
    expect(C.callStaffEmail({ user_account: " Nuriddin@VP.uz " })).toBe("nuriddin@vp.uz");
    expect(C.callStaffEmail({ user_name: "Nuriddin" })).toBe("");
    expect(C.callStaffEmail({})).toBe("");
  });
  it("sets a call-back 30 minutes on, in Tashkent time", () => {
    expect(C.dueIn(30, Date.parse("2026-11-12T13:45:00Z"))).toEqual({ due_date: "2026-11-12", due_time: "19:15" });
    expect(C.dueIn(30, Date.parse("2026-11-12T18:50:00Z"))).toEqual({ due_date: "2026-11-13", due_time: "00:20" });
  });
  it("adds a call-back only when none is due", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    expect(C.needsCallback([], now)).toBe(true);
    expect(C.needsCallback([{ status: "open", type: "call", due_date: "2026-11-12" }], now)).toBe(false);
    expect(C.needsCallback([{ status: "open", type: "call", due_date: "2026-11-14" }], now)).toBe(true);
    expect(C.needsCallback([{ status: "done", type: "call", due_date: "2026-11-12" }], now)).toBe(true);
    expect(C.needsCallback([{ status: "open", type: "design_approval", due_date: "2026-11-12" }], now)).toBe(true);
  });
});
