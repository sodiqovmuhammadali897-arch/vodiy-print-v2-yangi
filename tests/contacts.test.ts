import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { contactIndex, contactOfCall, contactProblem, phoneDigits, salesCalls } from "../src/lib/contacts";
const require = createRequire(import.meta.url);
const S = require("../meta-webhook/contacts.js");

describe("Kontaktlar", () => {
  const contacts = [
    { id: "c1", name: "Kuryer Anvar", phone: "+998 90 555 12 34", digits: "905551234", type: "supplier" as const },
    { id: "c2", name: "Ishxona", phone: "73 244 00 11", digits: "", type: "office" as const },
  ];
  const index = contactIndex(contacts);
  it("matches a call by the last 9 digits", () => {
    expect(contactOfCall({ phone: "998905551234" }, index)?.name).toBe("Kuryer Anvar");
    expect(contactOfCall({ phone: "+998 73 244 00 11" }, index)?.name).toBe("Ishxona"); // digits worked out from the phone
    expect(contactOfCall({ phone: "+998911112233" }, index)).toBeNull();
    expect(contactOfCall({ phone: "" }, index)).toBeNull();
  });
  it("sales calls leave the contacts out", () => {
    expect(salesCalls([{ phone: "905551234" }, { phone: "911112233" }], index)).toEqual([{ phone: "911112233" }]);
  });
  it("the form", () => {
    expect(contactProblem("", "905551234", [])).toBe("Ismini yozing");
    expect(contactProblem("A", "12345", [])).toBe("Telefon raqamini to'liq yozing");
    expect(contactProblem("A", "+998905551234", [{ id: "c1", name: "Kuryer Anvar", digits: "905551234" }])).toContain("Kuryer Anvar");
    expect(contactProblem("A", "+998905551234", [{ id: "c1", name: "Kuryer Anvar", digits: "905551234" }], "c1")).toBe("");
    expect(phoneDigits("+998 (90) 555-12-34")).toBe("905551234");
  });
  it("the server reads the same list", async () => {
    const db = { collection: () => ({ get: async () => ({ docs: contacts.map((c) => ({ id: c.id, data: () => c })) }) }) };
    const C = S.create(db);
    expect(await C.of("+998905551234")).toEqual({ id: "c1", name: "Kuryer Anvar", type: "supplier" });
    expect(await C.of("998732440011")).toMatchObject({ name: "Ishxona" });
    expect(await C.of("+998911112233")).toBeNull();
  });
});
