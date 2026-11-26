import { afterEach, describe, expect, it } from "vitest";
import { CRM_COLUMNS, CRM_TASK_TYPES, MANUAL_COLUMNS, columnOf, columnLabel, needsTask, taskTypeInfo } from "../src/lib/crm";
import { CONTACT_TYPES, contactType } from "../src/lib/contacts";
import { applyCrmSettings, sectionLabel } from "../src/lib/crmSettings";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const B = require("../meta-webhook/leadTaskBot.js");
const E = require("../meta-webhook/erpTasks.js");

afterEach(() => {
  applyCrmSettings(null);
  B.setTaskTypes(null);
});

describe("Sotuv bo'limi → Sozlamalar", () => {
  it("stages: new order, names, an added one; «Yangi» first, the order ones last", () => {
    applyCrmSettings({
      stages: [
        { key: "offer", label: "Taklif", color: "#111111" },
        { key: "new", label: "Kelgan", color: "#222222" },
        { key: "st_meet", label: "Uchrashuv", color: "#333333" },
        { key: "accepted", label: "Qabul", color: "#444444" },
        { key: "delivered", label: "Topshirildi", color: "#555555" },
      ],
    });
    expect(CRM_COLUMNS.map((c) => c.key)).toEqual(["new", "offer", "st_meet", "accepted", "info_given", "advance", "production", "delivered"]);
    expect(MANUAL_COLUMNS).toEqual(["new", "offer", "st_meet", "accepted", "info_given"]);
    expect(columnLabel("new")).toBe("Kelgan");
    expect(columnLabel("delivered")).toBe("Topshirildi");
    expect(columnLabel("info_given")).toBe("Ma'lumot berildi"); // kept with its own name
    expect(columnOf({ status: "st_meet" as never, converted_order_id: null }, {})).toBe("st_meet");
    expect(needsTask("st_meet")).toBe(true);
  });
  it("a removed stage's leftover lead shows in «Qabul qilindi»; defaults come back", () => {
    expect(columnOf({ status: "st_gone" as never, converted_order_id: null }, {})).toBe("accepted");
    expect(columnOf({ status: "design" as never, converted_order_id: null }, {})).toBe("advance");
    applyCrmSettings(null);
    expect(CRM_COLUMNS.map((c) => c.label)).toEqual(["Yangi", "Qabul qilindi", "Ma'lumot berildi", "Taklif yuborildi", "Dizayn / avans", "Ishlab chiqarish", "Yetkazildi"]);
  });
  it("task types, contact types, section names", () => {
    applyCrmSettings({
      task_types: [{ key: "call", label: "Telefon qilish", icon: "☎" }, { key: "tt_x", label: "Namuna olib borish", icon: "📦" }],
      contact_types: [{ key: "office", label: "Ofis", icon: "🏢" }, { key: "ct_bank", label: "Bank", icon: "🏦" }],
      sections: { zadachalar: "Eslatmalar", lidlar: "" },
    });
    expect(CRM_TASK_TYPES.map((t) => t.label)).toEqual(["Telefon qilish", "Namuna olib borish"]);
    expect(taskTypeInfo("follow_up").label).toBe("Qayta aloqa"); // a type in use but not in the list still has its name
    expect(CONTACT_TYPES.map((t) => t.label)).toEqual(["Ofis", "Bank"]);
    expect(contactType("staff").label).toBe("Boshqa");
    expect(sectionLabel("zadachalar")).toBe("Eslatmalar");
    expect(sectionLabel("lidlar")).toBe("Lidlar");
  });
  it("the server: names in Telegram, added stages need a task", () => {
    B.setTaskTypes([{ key: "call", label: "Telefon qilish", icon: "☎" }]);
    expect(B.typeInfo("call")).toEqual(["☎", "Telefon qilish"]);
    expect(B.typeInfo("nope")[1]).toBe("Zadacha");
    expect(E.needsTask({ status: "st_meet", created_at: "2026-11-20T00:00:00Z" })).toBe(true);
    expect(E.needsTask({ status: "advance", created_at: "2026-11-20T00:00:00Z" })).toBe(false);
    expect(E.needsTask({ status: "lost", created_at: "2026-11-20T00:00:00Z" })).toBe(false);
  });
});
