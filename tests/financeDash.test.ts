import { describe, expect, it } from "vitest";
import {
  breakdown,
  dataQuality,
  debtAging,
  deliveredDays,
  forecast30,
  isProvisional,
  marketing,
  monthSeries,
  monthsBetween,
  templateStatus,
  totals,
  type ExpenseTemplate,
  type FinanceInput,
} from "../src/lib/financeDash";
import type { Customer, Expense, Order, OrderCost, OrderPayment, StatusHistoryEntry } from "../src/lib/types";

const o = (id: string, date: string, total: number, extra: Partial<Order> = {}) =>
  ({ id, order_date: date, created_at: `${date}T10:00:00Z`, total_amount: total, paid_amount: 0, remaining_amount: 0, status: "new", is_draft: false, customer_id: null, customer_source: "", deadline: null, delivery_date: null, ...extra }) as unknown as Order;
const pay = (order_id: string, date: string, amount: number, type = "Naqd") => ({ id: `${order_id}${date}`, order_id, payment_date: date, amount, payment_type: type }) as unknown as OrderPayment;
const exp = (category: string, date: string, amount: number, extra = {}) => ({ id: `${category}${date}${amount}`, category, date, amount, note: "", ...extra }) as unknown as Expense;
const cost = (orderId: string, total: number) => [`order_${orderId}`, { id: `order_${orderId}`, order_id: orderId, total_cost: total, unit_cost: 0, source: "manual" } as OrderCost] as const;

const orders = [
  o("a", "2026-10-05", 10e6, { status: "delivered", customer_id: "c1", customer_source: "Instagram", deadline: "2026-10-20", paid_amount: 4e6 }),
  o("b", "2026-10-20", 6e6, { status: "production", customer_id: "c2", paid_amount: 6e6 }),
  o("c", "2026-09-10", 4e6, { status: "closed", customer_id: "c1", paid_amount: 4e6 }),
  o("d", "2026-10-25", 9e6, { status: "cancelled" }),
];
const history = [{ order_id: "a", status: "delivered", changed_at: "2026-10-28T09:00:00Z" }] as unknown as StatusHistoryEntry[];
const input: FinanceInput = {
  orders,
  payments: [pay("a", "2026-10-06", 4e6), pay("b", "2026-10-21", 6e6, "Karta"), pay("c", "2026-09-11", 4e6)],
  expenses: [exp("Ijara", "2026-10-01", 5e6), exp("Xomashyo", "2026-10-03", 2e6), exp("Maosh", "2026-09-30", 8e6)],
  lines: [],
  costs: new Map([cost("a", 6e6), cost("c", 2.4e6)]),
  history,
  withCost: true,
};
const oct = { from: "2026-10-01", to: "2026-10-31" };
const delivered = deliveredDays(orders, history);
const customers = new Map<string, Customer>([
  ["c1", { id: "c1", region: "Farg'ona", source: "" } as unknown as Customer],
  ["c2", { id: "c2", region: "", source: "Telegram" } as unknown as Customer],
]);

describe("finance dashboard", () => {
  it("keeps booked, delivered and collected money apart", () => {
    expect(delivered.get("a")).toBe("2026-10-28"); // from the status history
    expect(delivered.get("c")).toBe("2026-09-10"); // no history: the order date
    const t = totals(input, oct, delivered);
    expect(t).toMatchObject({ booked: 16e6, orders: 2, delivered: 10e6, collected: 10e6, expenses: 7e6, opex: 5e6, avgCheck: 8e6 });
  });

  it("counts profit from the typed cost, without subtracting raw materials twice", () => {
    const t = totals(input, oct, delivered);
    expect(t.cost).toBe(6e6);
    expect(t.missingLines).toBe(1); // order b has no cost
    expect(t.gross).toBe(10e6); // 16 − 6 on the tracked part
    expect(t.net).toBe(16e6 - 6e6 - 5e6); // Xomashyo is in the cost already
    expect(totals({ ...input, withCost: false }, oct, delivered)).toMatchObject({ cost: null, net: 16e6 - 7e6 });
  });

  it("builds the month series", () => {
    expect(monthsBetween("2026-07-15", "2026-10-02")).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    const s = monthSeries(input, ["2026-08", "2026-09", "2026-10"], delivered);
    expect(s.map((m) => [m.month, m.booked, m.costTracked])).toEqual([
      ["2026-08", 0, false],
      ["2026-09", 4e6, true],
      ["2026-10", 16e6, true],
    ]);
  });

  it("lists what makes the profit provisional", () => {
    const tmpl: ExpenseTemplate[] = [{ id: "t1", name: "Ofis ijarasi", category: "Ijara", amount: 5e6, due_day: 1, active: true }, { id: "t2", name: "Internet", category: "Kommunal", amount: 300000, due_day: 10, active: true }];
    const states = templateStatus(tmpl, input.expenses, "2026-10");
    expect(states.map((s) => [s.template.id, !!s.entered, s.dueDate])).toEqual([
      ["t1", true, "2026-10-01"], // same category and amount
      ["t2", false, "2026-10-10"],
    ]);
    const issues = dataQuality(input, oct, totals(input, oct, delivered), { customers, templates: states, monthLike: true });
    expect(issues.map((i) => i.key)).toEqual(["cost", "opex", "templates", "region"]);
    expect(issues[1].title).toBe("Kiritilmagan xarajat: Maosh, Reklama, Kommunal");
    expect(isProvisional(issues)).toBe(true);
    expect(isProvisional(issues.filter((i) => i.level === "info"))).toBe(false);
  });

  it("ages debt by its due date", () => {
    const aging = debtAging(orders, "2026-11-08");
    expect(aging.map((b) => [b.key, b.n, b.sum])).toEqual([
      ["not_due", 0, 0],
      ["d7", 0, 0],
      ["d30", 1, 6e6], // a: deadline 20 Oct, 19 days late
      ["d60", 0, 0],
      ["d60p", 0, 0],
    ]);
  });

  it("breaks sales down by region and source, with the change", () => {
    const sep = { from: "2026-09-01", to: "2026-09-30" };
    const r = breakdown(input, "region", oct, sep, customers);
    expect(r.map((x) => [x.key, x.orders, x.revenue, x.prevRevenue, x.share])).toEqual([
      ["Farg'ona", 1, 10e6, 4e6, 62.5],
      ["Yozilmagan", 1, 6e6, 0, 37.5],
    ]);
    expect(r[0].change).toBe(150);
    expect(breakdown(input, "source", oct, sep, customers).map((x) => x.key)).toEqual(["Instagram", "Telegram", "Yozilmagan"]); // September had one without a source
    expect(breakdown(input, "product", oct, sep, customers)[0]).toMatchObject({ key: "Boshqa", revenue: 16e6, margin: 40 });
  });

  it("works out the cost per lead and per new customer", () => {
    const m = marketing({ ...input, expenses: [exp("Reklama", "2026-10-02", 3e6)] }, ["2026-09", "2026-10"], [{ month: "2026-10", leads: { created: 600 } }, { month: "2026-10", leads: { created: 150 } }]);
    expect(m[1]).toEqual({ month: "2026-10", spend: 3e6, leads: 750, newCustomers: 1, cpl: 4000, cac: 3e6 });
    expect(m[0]).toMatchObject({ newCustomers: 1, cpl: null, cac: null });
  });

  it("forecasts the next 30 days without counting late debt", () => {
    const due = [o("x", "2026-11-01", 5e6, { deadline: "2026-11-12" }), o("y", "2026-10-01", 2e6, { deadline: "2026-10-10" })];
    const f = forecast30(due, [{ id: "t", name: "Ijara", category: "Ijara", amount: 5e6, due_day: 1, active: true }], [], "2026-11-08");
    expect(f.overdue).toBe(2e6);
    expect(f.weeks[0]).toMatchObject({ label: "0–7 kun", inflow: 5e6, outflow: 5e6 }); // November rent not entered yet
    expect(f.weeks.reduce((s, w) => s + w.outflow, 0)).toBe(10e6); // and December's on the 1st
  });
});

describe("comparison span", () => {
  it("compares a month so far with the same days of the month before", async () => {
    const { compareSpan } = await import("../src/lib/financeDash");
    expect(compareSpan({ from: "2026-11-01", to: "2026-11-08" }, "month")).toEqual({ from: "2026-10-01", to: "2026-10-08" });
    expect(compareSpan({ from: "2026-10-01", to: "2026-10-31" }, "prev_month")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(compareSpan({ from: "2026-03-01", to: "2026-03-31" }, "custom")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(compareSpan({ from: "2026-01-01", to: "2026-11-08" }, "year")).toEqual({ from: "2025-01-01", to: "2025-11-08" });
    expect(compareSpan({ from: "2026-11-02", to: "2026-11-08" }, "week")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
  });
});
