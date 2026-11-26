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

describe("leadFields — the lead's portrait from the form", () => {
  const { leadFields, regionOf } = require("../meta-webhook/leadText.js");
  const products = ["Futbolka", "Kepka", "Paket A4", "Gift Box"];

  it("fills name, brand, place, region, business and quantity as filled", () => {
    const questions = [
      { key: "ismi", label: "Ismi" },
      { key: "nechta?", label: "Nechta", options: [{ key: "100_-_200_ta", value: "100 - 200 ta" }] },
      { key: "qanday_biznes", label: "Qanday biznes" },
    ];
    const f = leadFields(
      [
        { name: "ismi", values: ["Nozimaxon"] },
        { name: "phone_number", values: ["+998995966606"] },
        { name: "nechta?", values: ["100_-_200_ta"] },
        { name: "brend_nomi", values: ["Maliha brend"] },
        { name: "manzili", values: ["Marg'ilon shahar"] },
        { name: "qanday_biznes", values: ["boshqa"] },
        { name: "qaysi_mahsulot", values: ["futbolka va kepka"] },
      ],
      questions,
      products,
    );
    expect(f.full_name).toBe("Nozimaxon");
    expect(f.phone).toBe("+998995966606");
    expect(f.quantity).toBe("100 - 200 ta");
    expect(f.brand).toBe("Maliha brend");
    expect(f.address).toBe("Marg'ilon shahar");
    expect(f.region).toBe("Farg'ona");
    expect(f.industry).toBe("boshqa");
    expect(f.product_types).toEqual(["Futbolka", "Kepka"]);
    expect(f.interested_product_name).toBe("futbolka va kepka");
    expect(f.form_answers).toEqual([
      { label: "Ismi", value: "Nozimaxon" },
      { label: "Telefon", value: "+998995966606" },
      { label: "Nechta", value: "100 - 200 ta" },
      { label: "brend nomi", value: "Maliha brend" },
      { label: "manzili", value: "Marg'ilon shahar" },
      { label: "Qanday biznes", value: "boshqa" },
      { label: "qaysi mahsulot", value: "futbolka va kepka" },
    ]);
  });

  it("without the form's questions, tidies Meta's keys and keeps unknown answers", () => {
    const f = leadFields([{ name: "nechta_kerak?", values: ["500_dan_ko'p"] }, { name: "rang", values: ["qora"] }, { name: "email", values: [""] }]);
    expect(f.quantity).toBe("500 dan ko'p");
    expect(f.form_answers).toEqual([
      { label: "nechta kerak?", value: "500 dan ko'p" },
      { label: "rang", value: "qora" },
    ]);
    expect(f.region).toBeUndefined();
  });

  it("finds the region from a town or a region answer", () => {
    expect(regionOf("Qo'qon shahri")).toBe("Farg'ona");
    expect(regionOf("Андижон")).toBe("Andijon");
    expect(regionOf("Chust tumani")).toBe("Namangan");
    expect(regionOf("Moskva")).toBe("");
    expect(leadFields([{ name: "viloyat", values: ["Toshkent sh."] }]).region).toBe("Toshkent");
    expect(leadFields([{ name: "city", values: ["Fargona"] }]).region).toBe("Farg'ona");
  });
});
