import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { backfill, fillBlanks } = require("../meta-webhook/leadPortrait.js");

// A tiny in-memory Firestore: collections of {id → data}.
function fakeDb(data: Record<string, Record<string, any>>) {
  const col = (name: string) => {
    data[name] = data[name] || {};
    const ref = (id: string) => ({
      id,
      get: async () => ({ exists: id in data[name], data: () => data[name][id] }),
      set: async (v: any, o?: any) => void (data[name][id] = o?.merge ? { ...(data[name][id] || {}), ...v } : v),
      update: async (v: any) => void (data[name][id] = { ...data[name][id], ...v }),
    });
    return {
      doc: ref,
      get: async () => {
        const docs = Object.entries(data[name]).map(([id, v]) => ({ id, data: () => v, ref: ref(id) }));
        return { size: docs.length, docs };
      },
    };
  };
  return { collection: col };
}

describe("lead portrait backfill", () => {
  it("fills only blanks; a «Noma'lum» name counts as blank", () => {
    const p = fillBlanks({ full_name: "Noma'lum", brand: "Typed by manager", region: "" }, { full_name: "Nozimaxon", brand: "Form brand", region: "Farg'ona", phone: "1", form_answers: [{ label: "a", value: "b" }] });
    expect(p).toEqual({ full_name: "Nozimaxon", region: "Farg'ona", form_answers: [{ label: "a", value: "b" }] });
  });

  it("matches by lead_id or phone, runs once, counts", async () => {
    const data: any = {
      meta_leads: { g1: { form_id: "f1", lead_id: "L1" }, g2: { form_id: "f1" }, g3: { form_id: "f1" }, g4: { form_id: "f1" } },
      leads: {
        L1: { source: "Instagram Target", phone: "+998 90 111 22 33", full_name: "Noma'lum" },
        L2: { source: "Facebook Lead Ads", phone: "901234567", full_name: "Ali", brand: "" },
        L3: { source: "Telefon", phone: "+998 99 999 99 99", full_name: "" },
      },
    };
    const meta: any = {
      g1: { form_id: "f1", field_data: [{ name: "ismi", values: ["Nozimaxon"] }, { name: "nechta", values: ["100_-_200_ta"] }] },
      g2: { form_id: "f1", field_data: [{ name: "phone_number", values: ["+998901234567"] }, { name: "brend_nomi", values: ["Maliha"] }] },
      g3: { error: { message: "expired" } },
      g4: { form_id: "f1", field_data: [{ name: "phone_number", values: ["+998999999999"] }] }, // a phone lead, not a form lead
    };
    const db = fakeDb(data);
    const opts = { fetchLead: async (id: string) => meta[id], questionsOf: async () => [], log: { log() {} }, wait: async () => {} };
    const n = await backfill(db, opts);
    expect(n).toMatchObject({ meta: 4, filled: 2, unreadable: 1, unmatched: 1 });
    expect(data.leads.L1.full_name).toBe("Nozimaxon");
    expect(data.leads.L1.quantity).toBe("100 - 200 ta");
    expect(data.leads.L2.brand).toBe("Maliha");
    expect(data.leads.L2.full_name).toBe("Ali");
    expect(data.meta_leads.g2.lead_id).toBe("L2");
    expect(data.crm_meta.portrait_backfill.done_at).toBeTruthy();
    expect(await backfill(db, opts)).toBeNull();
  });
});
