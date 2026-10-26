import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, draftSummary, hasContent, readDraft, writeDraft } from "../src/lib/orderDraft";
import type { OrderPayload, WizardProduct } from "../src/lib/orderService";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const payload = { title: "", customer_id: null } as unknown as OrderPayload;
const line = (name: string, quantity = 0) => ({ product_name: name, quantity }) as WizardProduct;

describe("orderDraft", () => {
  beforeEach(() => store.clear());

  it("keeps a started order and brings it back", () => {
    writeDraft("A@x.uz", "new", { payload: { ...payload, customer_id: "c1" }, products: [line("Paket A4", 500)], payments: [], step: 1 });
    const d = readDraft("a@x.uz", "new");
    expect(d?.payload.customer_id).toBe("c1");
    expect(d?.products[0].product_name).toBe("Paket A4");
    expect(d?.step).toBe(1);
    expect(readDraft("b@x.uz", "new")).toBeNull();
  });

  it("an empty wizard does not wipe a kept draft; clearDraft does", () => {
    writeDraft("a@x.uz", "new", { payload, products: [line("Flayer")], payments: [], step: 0 });
    writeDraft("a@x.uz", "new", { payload, products: [], payments: [], step: 0 });
    expect(readDraft("a@x.uz", "new")).not.toBeNull();
    clearDraft("a@x.uz", "new");
    expect(readDraft("a@x.uz", "new")).toBeNull();
  });

  it("knows what is worth keeping and names it", () => {
    expect(hasContent({ payload, products: [line("")], payments: [] })).toBe(false);
    expect(hasContent({ payload, products: [line("", 10)], payments: [] })).toBe(true);
    const d = { payload, products: ["Paket", "Flayer", "Kepka", "Bakal"].map((n) => line(n)), payments: [], step: 0, saved_at: "" };
    expect(draftSummary(d)).toBe("Paket, Flayer, Kepka va yana 1 ta");
  });

  it("ignores a broken copy", () => {
    store.set("vp_order_draft:a@x.uz:new", "{not json");
    expect(readDraft("a@x.uz", "new")).toBeNull();
  });
});
