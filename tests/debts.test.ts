import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const D = require("../meta-webhook/debts");

const today = "2026-11-10";
const order = (id: string, extra: Record<string, unknown> = {}) => ({ id, manager_name: "Maryam", status: "delivered", remaining_amount: 1_000_000, order_date: "2026-10-01", title: "Paket", ...extra });

describe("qarz undirish", () => {
  const orders = [
    order("a"), // handed over 25 Oct (history)
    order("b", { remaining_amount: 0 }), // paid
    order("c", { status: "production" }), // not handed over: not a debt
    order("d", { status: "ready_to_deliver", remaining_amount: 2_000_000 }), // collect on delivery
    order("e", { status: "closed", order_date: "2026-11-08" }), // no history: its date
    order("f", { status: "cancelled" }),
  ];
  const historyOf = new Map([["a", [{ status: "production", changed_at: "2026-10-05T10:00:00Z" }, { status: "delivered", changed_at: "2026-10-25T10:00:00Z" }]]]);
  const by = D.debtsByManager(orders, historyOf, today);

  it("counts only handed-over orders as debts, oldest first, from the handover day", () => {
    expect(by.get("maryam").debts.map((d: { order_id: string; days: number }) => [d.order_id, d.days])).toEqual([["a", 16], ["e", 2]]);
    expect(by.get("maryam").onDelivery.map((d: { order_id: string }) => d.order_id)).toEqual(["d"]);
  });

  it("asks today about debts without a promise or with a promise that is due", () => {
    const st = new Map([["a", { promise_day: "2026-11-12" }], ["e", { promise_day: "2026-11-10" }]]);
    expect(D.dueToday(by.get("maryam").debts, st, today).map((d: { order_id: string }) => d.order_id)).toEqual(["e"]);
  });

  it("writes the message and the evening summary", () => {
    const t = D.debtText(by.get("maryam").debts[0], { company: "Megaton", first_name: "Ali", phone: "+998901112233" }, 1, 2, null);
    expect(t).toContain("1/2 · Megaton — Ali");
    expect(t).toContain("Qarz: 1 mln · topshirilganiga 16 kun ⚠️");
    const s = D.summaryText(today, [{ name: "Maryam", collected: 3_500_000, debt: 22_500_000, count: 3, old: 1 }], [{ who: "Megaton", rest: 1e6, promise_day: "2026-11-08", manager: "Maryam" }]);
    expect(s).toContain("Maryam — bugun undirdi 3,5 mln · qarz 22,5 mln (3 ta) · 14+ kun: 1 ⚠️");
    expect(s).toContain("Va'da bajarilmadi");
  });
});
