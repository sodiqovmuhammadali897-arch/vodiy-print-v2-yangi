import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeFunnel, historyFromEvents, contactPhoneKeys } = require("../meta-webhook/amoFunnel");

const P = 10;
const statuses = {
  [`${P}:1`]: { name: "Неразобранное", sort: 10 },
  [`${P}:2`]: { name: "Қабул Қилинди", sort: 20 },
  [`${P}:3`]: { name: "маълумот берилди", sort: 30 },
  [`${P}:4`]: { name: "Таклиф Юборилди", sort: 40 },
  [`${P}:5`]: { name: "Дизайн/аванс", sort: 50 },
  [`${P}:142`]: { name: "етказилди", sort: 10000 },
  [`${P}:143`]: { name: "Муваффақиятсиз", sort: 11000 },
};
const at = (d: string) => Date.parse(`${d}T10:00:00+05:00`);
const lead = (id: number, day: string, status: number, extra = {}) => ({ id, created: at(day), updated: at(day), closed: null, status, pipeline: P, user: 7, contact: id * 10, price: 0, loss: null, source: "Instagram", ...extra });
const leads = [
  lead(1, "2026-10-02", 2), // stuck in the first stage, never talked
  lead(2, "2026-10-03", 143, { closed: at("2026-10-10") }), // reached info, then lost without reason
  lead(3, "2026-10-05", 142, { closed: at("2026-10-20"), user: 8, source: "Telefon" }), // won, ordered and paid
  lead(4, "2026-10-06", 4), // in offer now
  lead(5, "2026-09-30", 2), // September: not in the cohort
];
const history = historyFromEvents([
  { entity_id: 2, value_before: [{ lead_status: { id: 2, pipeline_id: P } }], value_after: [{ lead_status: { id: 3, pipeline_id: P } }] },
  { entity_id: 2, value_before: [{ lead_status: { id: 3, pipeline_id: P } }], value_after: [{ lead_status: { id: 143, pipeline_id: P } }] },
]);
const calls = [
  { entity: "l", entityId: 2, at: at("2026-10-03") + 20 * 60000, duration: 95 },
  { entity: "c", entityId: 30, at: at("2026-10-05") + 5 * 60000, duration: 40 },
  { entity: "c", entityId: 40, at: at("2026-10-06") + 60000, duration: 10 }, // too short to count as talked
];
const contactPhones = new Map([[30, ["901234567"]], [40, ["907777777"]]]);
const customers = [{ id: "c3", phone: "+998 90 123 45 67", first_name: "X" }];
const orders = [
  { id: "o3", customer_id: "c3", order_date: "2026-10-12", status: "delivered", total_amount: 5_000_000, paid_amount: 5_000_000 },
  { id: "o9", customer_id: "c3", order_date: "2026-08-01", status: "closed", total_amount: 1 }, // before the lead: not counted
  { id: "o8", customer_id: "zz", order_date: "2026-10-15", status: "new", total_amount: 1 },
];
const payments = [{ order_id: "o3", payment_date: "2026-10-14", amount: 5_000_000 }];
const users = new Map([[7, { name: "Diyorbek" }], [8, { name: "Nuriddin" }]]);

describe("sales funnel", () => {
  const f = computeFunnel({ month: "2026-10", leads, calls, history, statuses, contactPhones, users, orders, customers, payments, callsFrom: at("2026-09-01"), now: at("2026-11-04") });

  it("counts how far the month's leads got", () => {
    expect(f.info_key).toBe(`${P}:3`);
    expect(f.offer_key).toBe(`${P}:4`);
    expect(f.all).toMatchObject({ leads: 4, talked: 2, won: 1, lost: 1, lost_no_reason: 1, ordered: 1, paid: 1, order_sum: 5_000_000 });
    expect(f.all.reached[`${P}:3`]).toBe(3); // lead 2 (history), 3 (won), 4 (offer)
    expect(f.all.reached[`${P}:4`]).toBe(2);
    expect(f.all.lost_after).toEqual({ [`${P}:3`]: 1 });
  });

  it("splits by manager and source, and times it", () => {
    expect(f.users.map((u: { name: string; leads: number }) => [u.name, u.leads])).toEqual([["Diyorbek", 3], ["Nuriddin", 1]]);
    expect(f.sources).toEqual([{ name: "Instagram", leads: 3, ordered: 0 }, { name: "Telefon", leads: 1, ordered: 1 }]);
    expect(f.speed).toEqual({ first_call_min: 5, lead_to_order_days: 7, order_to_paid_days: 2 });
  });

  it("shows what is out of order in amoCRM", () => {
    expect(f.hygiene).toMatchObject({ stuck_first_stage: 2, erp_orders: 2, amo_won: 1, lost_no_reason: 1 });
    expect(f.hygiene.unused_stages).toEqual(["Дизайн/аванс"]); // lead 3 was won straight from the first stage
  });

  it("says talked is unknown before calls were loaded", () => {
    const g = computeFunnel({ month: "2026-10", leads, calls, history, statuses, contactPhones, users, orders, customers, payments, callsFrom: at("2026-10-15"), now: at("2026-11-04") });
    expect(g.all.talked).toBeNull();
    expect(g.all.first_call_min).toBeNull();
    expect(g.speed.first_call_min).toBeNull();
  });

  it("keeps no names or phones", () => {
    const text = JSON.stringify(f);
    expect(text).not.toContain("901234567");
    expect(text).not.toContain('"X"');
  });

  it("reads contact phones as keys", () => {
    expect(contactPhoneKeys({ custom_fields_values: [{ field_code: "PHONE", values: [{ value: "+998 (90) 123-45-67" }, { value: "901234567" }] }] })).toEqual(["901234567"]);
  });
});
