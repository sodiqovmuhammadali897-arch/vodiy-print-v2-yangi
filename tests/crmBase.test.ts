import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { baseCounts, historyFor, matchesBase, reopenFields, EMPTY_FILTER, sortBase } from "../src/lib/crmBase";
import type { CrmBaseDoc } from "../src/lib/types";
const require = createRequire(import.meta.url);
const { amoEntry, erpEntry, mergeDoc, planAmo } = require("../meta-webhook/crmBase.js");

const deal = (id: number, status: number, extra: any = {}) => ({
  id, status_id: status, price: 1000000, name: "Сделка", created_at: 1760000000, closed_at: 1762000000 + id,
  custom_fields_values: [
    { field_name: "Ёпилиш сабаби", values: [{ value: "Нарх қиммат" }] },
    { field_name: "Бренд номи", values: [{ value: "Малика" }] },
    { field_name: "Махсулот тури", values: [{ value: "Футболка" }] },
  ],
  ...extra,
});

describe("crm_base on the server", () => {
  it("an amoCRM lost deal keeps its reason in Latin and its group", () => {
    const e = amoEntry(deal(5, 143), { user: "Нуриддин", staffEmail: "n@vp.uz" });
    expect(e).toMatchObject({ key: "amo:5", source: "amo", status: "lost", reason: "Narx qimmat", group: "price", manager_name: "Nuriddin", product: "Futbolka", price: 1000000 });
    expect(amoEntry(deal(6, 142))).toMatchObject({ status: "won", group: "won", reason: "" });
  });

  it("groups deals by phone, counts the ones without a phone", () => {
    const rows = [
      { deal: deal(1, 143), contact: { name: "Азиз", phone: "+998 90 123-45-67" }, user: "A" },
      { deal: deal(2, 142), contact: { name: "", phone: "901234567" }, user: "B" },
      { deal: deal(3, 143), contact: { name: "X", phone: "" }, user: "C" },
    ];
    const { byPhone, counts } = planAmo(rows);
    expect(counts).toMatchObject({ deals: 3, withPhone: 2, noPhone: 1, customers: 1, won: 1, lost: 2 });
    const g = byPhone.get("901234567");
    expect(g.person).toMatchObject({ name: "Aziz", brand: "Malika" });
    expect(g.entries.map((e: any) => e.key)).toEqual(["amo:1", "amo:2"]);
  });

  it("merges into an existing doc: no duplicates, newest first, blanks only", () => {
    const first = mergeDoc(null, { digits: "901234567", phone: "+998901234567", name: "Aziz" }, [amoEntry(deal(1, 143)), amoEntry(deal(2, 142))], "t1");
    expect(first.deals.map((d: any) => d.key)).toEqual(["amo:2", "amo:1"]);
    expect(first.last).toMatchObject({ status: "won" });
    expect([first.lost, first.won]).toEqual([1, 1]);
    const lead = { id: "L1", phone: "901234567", status: "lost", lost_reason: "Raqobatchi tanlandi", lost_at: "2026-11-20T05:00:00Z", assigned_to_name: "Nuriddin", full_name: "Boshqa", estimated_amount: 5000000 };
    const again = mergeDoc({ ...first, reopened: { count: 1 } }, { digits: "901234567", name: "Boshqa", brand: "Yangi" }, [amoEntry(deal(1, 143)), erpEntry(lead)], "t2");
    expect(again.deals.length).toBe(3);
    expect(again.deals[0]).toMatchObject({ key: "erp:L1", group: "competitor", lead_id: "L1" });
    expect(again.name).toBe("Aziz");
    expect(again.brand).toBe("Yangi");
    expect(again.reopened).toEqual({ count: 1 });
    expect(again.sum).toBe(5000000);
  });
});

const base = (id: string, group: string, closed: string, extra: Partial<CrmBaseDoc> = {}): CrmBaseDoc => ({
  id, digits: id, phone: `+998${id}`, name: `N${id}`, deals: [{ key: `amo:${id}`, source: "amo", status: group === "won" ? "won" : "lost", reason: group === "price" ? "Narx qimmat" : "", group, closed_at: closed, created_at: "", manager_name: "Nuriddin", manager_email: "", product: "Paket A4", price: 100, title: "" }],
  last: { status: group === "won" ? "won" : "lost", reason: "", group, closed_at: closed, manager_name: "Nuriddin", source: "amo" }, lost: 1, won: 0, sum: 100, ...extra,
});

describe("crm_base in the app", () => {
  const list = [base("901111111", "price", "2026-10-01"), base("902222222", "won", "2025-12-01"), base("903333333", "price", "2026-11-01", { reopened: { count: 1, last_at: "", lead_id: "L", by_name: "", to_name: "" } })];
  it("filters by group, year, search and «not reopened»", () => {
    expect(list.filter((c) => matchesBase(c, { ...EMPTY_FILTER, group: "price" })).length).toBe(2);
    expect(list.filter((c) => matchesBase(c, { ...EMPTY_FILTER, year: "2025" })).length).toBe(1);
    expect(list.filter((c) => matchesBase(c, { ...EMPTY_FILTER, q: "2222" })).length).toBe(1);
    expect(list.filter((c) => matchesBase(c, { ...EMPTY_FILTER, q: "paket" })).length).toBe(3);
    expect(list.filter((c) => matchesBase(c, { ...EMPTY_FILTER, fresh: true })).length).toBe(2);
    expect(baseCounts(list)).toEqual({ all: 3, price: 2, won: 1 });
    expect(sortBase(list).map((c) => c.id)).toEqual(["903333333", "901111111", "902222222"]);
  });
  it("the reopened lead carries the history; the card hides the lead's own deal", () => {
    const r = reopenFields(list[0]);
    expect(r).toMatchObject({ phone: "+998901111111", status: "accepted", source: "Mijozlar bazasi", interested_product_name: "Paket A4" });
    expect(r.note).toContain("Narx qimmat (Nuriddin)");
    expect(r.taskNote).toContain("Narx qimmat");
    const doc = { ...list[0], deals: [...list[0].deals, { ...list[0].deals[0], key: "erp:L9", lead_id: "L9" }] };
    expect(historyFor(doc, "L9").length).toBe(1);
  });
});

describe("full customer: calls, notes, fields", () => {
  const { amoCall, amoNote, allFields, mergeDoc: merge, planAmo: plan } = require("../meta-webhook/crmBase.js");
  const users = new Map([[7, { name: "Нуриддин" }]]);
  it("reads a Mois Zvonki call note and a text note", () => {
    const c = amoCall({ id: 1, entity_type: "l", note_type: "call_in", created_by: 7, created_at: 1762000000, params: { uniq: "u1", duration: 95, link: "https://rec/1.mp3", phone: "+998901234567" } }, users);
    expect(c).toMatchObject({ id: "u1", dir: "in", sec: 95, who: "Nuriddin", link: "https://rec/1.mp3", src: "amo" });
    expect(amoNote({ id: 9, created_by: 7, created_at: 1762000000, params: { text: "Нархни сўради" } }, users)).toMatchObject({ id: "amo:9", who: "Nuriddin", text: "Narxni so'radi" });
  });
  it("keeps every filled field, dates as days", () => {
    expect(allFields({ custom_fields_values: [{ field_name: "Буюртма хажми", values: [{ value: "Катта буюртма" }] }, { field_name: "Тайёр бўлиш санаси", values: [{ value: 1762000000 }] }, { field_name: "Бўш", values: [] }] })).toEqual([
      { label: "Buyurtma xajmi", value: "Katta buyurtma" },
      { label: "Tayyor bo'lish sanasi", value: "2025-11-01" },
    ]);
  });
  it("calls and notes go to the customer by phone, merged without duplicates", () => {
    const callsByPhone = new Map([["901234567", [{ id: "u1", at: "2026-10-01T05:00:00Z", dir: "in", sec: 95, who: "N", link: "x", src: "amo" }]]]);
    const notesByDeal = new Map([[1, [{ id: "amo:9", at: "2026-10-01T06:00:00Z", who: "N", text: "Salom" }]]]);
    const { byPhone, counts } = plan([{ deal: { id: 1, status_id: 143, created_at: 1, closed_at: 2 }, contact: { name: "A", phone: "901234567" } }], { callsByPhone, notesByDeal });
    expect(counts).toMatchObject({ calls: 1, recorded: 1, notes: 1 });
    const g = byPhone.get("901234567");
    const doc = merge(null, g.person, g.entries, "t", { calls: g.calls, notes: g.notes });
    const again = merge(doc, g.person, g.entries, "t2", { calls: [...g.calls, { id: "u2", at: "2026-11-01T05:00:00Z", dir: "out", sec: 0, who: "N", link: "", src: "amo" }], notes: g.notes });
    expect(again.calls.map((c: any) => c.id)).toEqual(["u2", "u1"]);
    expect(again.notes.length).toBe(1);
    expect([again.calls_count, again.talk_sec]).toEqual([2, 95]);
  });
});

describe("the ERP's own calls next to amoCRM's", () => {
  it("same call in both is kept once, with the recording", async () => {
    const { mergeCalls, phoneForms } = await import("../src/lib/crmBase");
    const out = mergeCalls(
      [{ id: "u1", at: "2026-11-20T05:00:10.000Z", dir: "in", sec: 60, who: "N", link: "", src: "amo" }],
      [
        { id: "e1", direction: "in", duration_seconds: 60, recording_url: "https://r/1.aac", start_time: "2026-11-20T05:00:40.000Z" },
        { id: "e2", direction: "out", duration_seconds: 0, start_time: "2026-11-21T05:00:00.000Z", staff_name: "M" },
      ],
    );
    expect(out.map((c) => c.id)).toEqual(["erp:e2", "u1"]);
    expect(out[1].link).toBe("https://r/1.aac");
    expect(phoneForms("901234567", "+998 90 123 45 67")).toEqual(["901234567", "998901234567", "+998901234567", "+998 90 123 45 67"]);
  });
});
