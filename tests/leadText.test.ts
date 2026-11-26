import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { metaLeadText, tashkentStamp } = require("../meta-webhook/leadText.js");

describe("Meta lead message", () => {
  const fieldData = [
    { name: "full_name", values: ["Mehrishoda"] },
    { name: "phone_number", values: ["+998886525000"] },
    { name: "brend_nomi", values: ["Mehri beauty cosmetics"] },
    { name: "nechta", values: ["100_-_200_ta"] },
    { name: "qanday_biznes", values: ["boshqa"] },
    { name: "empty", values: [""] },
  ];
  const questions = [
    { key: "full_name", label: "Ismi" },
    { key: "brend_nomi", label: "Brend nomi" },
    { key: "nechta", label: "Nechta", options: [{ key: "100_-_200_ta", value: "100 - 200 ta" }] },
  ];
  it("as the owner's example: form, every answer, source, time", () => {
    const t = metaLeadText({ formName: "Vodiy print 9", fieldData, questions, platform: "ig", createdTime: "2026-11-26T09:55:30+0000", leadNumber: "LID-310", url: "https://printvodiy.uz/leads" });
    expect(t).toBe(
      [
        "🧾 Nomi: Vodiy print 9",
        "📝 Ma'lumotlar:",
        "    Ismi: Mehrishoda",
        "    Telefon: +998886525000",
        "    Brend nomi: Mehri beauty cosmetics",
        "    Nechta: 100 - 200 ta",
        "    qanday_biznes: boshqa",
        "ℹ️ Manba: Instagram",
        "📆 Sana: 26-11-2026 14:55:30",
        "🆔 LID-310 · https://printvodiy.uz/leads",
      ].join("\n"),
    );
  });
  it("without the form's questions shows raw names; Facebook source", () => {
    const t = metaLeadText({ formName: "F", fieldData: fieldData.slice(3, 4), platform: "fb", createdTime: "2026-11-26T19:30:00+0000" });
    expect(t).toContain("    nechta: 100_-_200_ta");
    expect(t).toContain("ℹ️ Manba: Facebook");
    expect(tashkentStamp("2026-11-26T19:30:00+0000")).toBe("27-11-2026 00:30:00");
  });
});
