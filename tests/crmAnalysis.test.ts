import { describe, expect, it } from "vitest";
import { analysisSpan, crmAnalysis } from "../src/lib/crmAnalysis";
import type { Lead } from "../src/lib/types";

const L = (id: string, o: Partial<Lead>): Lead => ({ id, created_at: "2026-11-20T05:00:00Z", status: "new", source: "Instagram", assigned_to_email: "a@vp", assigned_to_name: "Ali", lost_reason: "", converted_order_id: null, ...o }) as Lead;
const now = Date.parse("2026-11-26T12:00:00+05:00");

describe("ERP tahlili", () => {
  const leads = [
    L("1", {}),
    L("2", { status: "accepted" }),
    L("3", { status: "offer", source: "Telefon" }),
    L("4", { status: "lost", lost_reason: "Narx qimmat" }),
    L("5", { status: "advance", converted_order_id: "o1", source: "Telefon", assigned_to_email: "b@vp", assigned_to_name: "Bek" }),
    L("6", { status: "advance", converted_order_id: "o2" }),
    L("old", { created_at: "2026-10-01T00:00:00Z" }), // outside the period
    L("first", { created_at: "2026-11-05T00:00:00Z" }), // the first version's lead (before CRM_START): hidden
    L("amo", { created_at: "2026-11-03T00:00:00Z", amo_id: 77, status: "accepted", source: "amoCRM" }), // moved from amoCRM: counted
  ];
  const orders = { o1: { status: "production", total_amount: 2_000_000 }, o2: { status: "cancelled", total_amount: 500_000 } } as never;
  const a = crmAnalysis({ leads, orders, span: analysisSpan("month", now) });
  it("cohort and totals", () => {
    expect(a.total.leads).toBe(7);
    expect(a.total.won).toBe(1);
    expect(a.total.sum).toBe(2_000_000);
    expect(a.total.lost).toBe(2); // lost + cancelled order
    expect(a.fromAmo).toBe(1);
  });
  it("funnel: how far they got", () => {
    expect(a.funnel.map((f) => f.n)).toEqual([7, 4, 2, 2, 1, 1, 0]);
  });
  it("sources, managers, reasons", () => {
    expect(a.sources.find((r) => r.key === "Telefon")).toMatchObject({ leads: 2, won: 1, conv: 0.5 });
    expect(a.managers.find((r) => r.key === "b@vp")).toMatchObject({ label: "Bek", leads: 1, won: 1, sum: 2_000_000 });
    expect(a.reasons).toEqual([{ label: "Narx qimmat", n: 1 }, { label: "Sababsiz", n: 1 }]);
  });
  it("periods", () => {
    expect(new Date(analysisSpan("prev_month", now).from + 5 * 3600e3).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(analysisSpan("d30", now).to).toBe(now);
  });
});
