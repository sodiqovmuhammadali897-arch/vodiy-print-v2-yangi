import { describe, expect, it } from "vitest";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const I = require("../meta-webhook/amoImport.js");

const deal = {
  id: 501,
  name: "Сделка #501",
  price: 1_500_000,
  created_at: Date.parse("2026-11-03T06:00:00Z") / 1000,
  updated_at: Date.parse("2026-11-20T06:00:00Z") / 1000,
  responsible_user_id: 13825130,
  _embedded: { tags: [{ name: "корпоратив" }] },
  custom_fields_values: [
    { field_name: "Brend nomi", values: [{ value: "Oq Non" }] },
    { field_name: "Вилоят", values: [{ value: "Фарғона" }] },
    { field_name: "Мижоз тури", values: [{ value: "Корпоратив мижоз" }] },
    { field_name: "Мижоз манбаси", values: [{ value: "Инстаграм" }] },
    { field_name: "Буюртма хажми", values: [{ value: "Катта буюртма" }] },
    { field_name: "Тўлов тури", values: [{ value: "Пул ўтказма" }] },
    { field_name: "Махсулот тури", values: [{ value: "Пакет" }, { value: "Блокнот" }] },
    { field_name: "Тайёр бўлиш санаси", values: [{ value: Date.parse("2026-12-01T00:00:00+05:00") / 1000 }] },
  ],
};

describe("amoCRM → ERP leads", () => {
  it("writes Cyrillic in Latin", () => {
    expect(I.latin("Фарғона")).toBe("Farg'ona");
    expect(I.latin("Ўзбекистон")).toBe("O'zbekiston");
    expect(I.latin("Ешонқул ака")).toBe("Yeshonqul aka");
    expect(I.latin("Пул ўтказма")).toBe("Pul o'tkazma");
    expect(I.latin("Oq Non")).toBe("Oq Non");
  });
  it("maps stages", () => {
    expect(I.stageStatus("Неразобранное")).toBe("new");
    expect(I.stageStatus("Қабул Қилинди")).toBe("accepted");
    expect(I.stageStatus("маълумот берилди")).toBe("info_given");
    expect(I.stageStatus("Таклиф Юборилди")).toBe("offer");
    expect(I.stageStatus("Дизайн/аванс")).toBe("advance");
    expect(I.stageStatus("ишлаб чикариш")).toBe("production");
    expect(I.stageStatus("???")).toBe("accepted");
  });
  it("a deal becomes a lead", () => {
    const l = I.toErpLead(deal, { contact: { name: "Алишер ака", phone: "+998901234567" }, stageName: "Қабул Қилинди", staff: { email: "nur@vp.uz", name: "Nuriddin" } });
    expect(l).toMatchObject({
      full_name: "Alisher aka",
      phone: "+998901234567",
      brand: "Oq Non",
      region: "Farg'ona",
      customer_type: "Korporativ mijoz",
      source: "Instagram",
      order_volume: "Katta buyurtma",
      payment_type: "Pul o'tkazma",
      product_types: ["Paket", "Bloknot"],
      ready_date: "2026-12-01",
      tags: ["korporativ"],
      status: "accepted",
      estimated_amount: 1_500_000,
      assigned_to_email: "nur@vp.uz",
      amo_id: 501,
      created_at: "2026-11-03T06:00:00.000Z",
    });
    expect(I.toErpLead({ id: 2, created_at: 0 }, {}).full_name).toBe("Noma'lum (amoCRM)");
  });
  it("an open task becomes an ERP task", () => {
    const t = I.toErpTask({ complete_till: Date.parse("2026-11-27T10:00:00+05:00") / 1000, task_type_id: 1, text: "Қўнғироқ қилиш" }, { id: "L1", full_name: "Ali", assigned_to_email: "a@vp", assigned_to_name: "A" });
    expect(t).toMatchObject({ lead_id: "L1", type: "call", due_date: "2026-11-27", due_time: "10:00", note: "Qo'ng'iroq qilish", status: "open" });
  });
  it("plan: new, linked by phone, already moved", () => {
    const erp = [
      { id: "e1", phone: "90 123 45 67", status: "accepted", created_at: "2026-11-15T00:00:00Z" },
      { id: "e2", phone: "", amo_id: 900, amo_ids: [900, 901], status: "new", created_at: "2026-10-01T00:00:00Z" },
    ];
    const mk = (id: number, phone: string) => ({ deal: { id }, lead: { phone, amo_id: id, created_at: "2026-11-01T00:00:00Z", status: "accepted" } });
    const p = I.plan(erp, [mk(900, ""), mk(901, ""), mk(1, "+998901234567"), mk(2, "+998911112233"), mk(3, "911112233"), mk(4, "")]);
    expect(p.already).toBe(2);
    expect(p.link.map((x: { deal: { id: number }; erp: { id: string } }) => [x.deal.id, x.erp.id])).toEqual([[1, "e1"], [3, "new:2"]]);
    expect(p.create.map((x: { deal: { id: number } }) => x.deal.id)).toEqual([2, 4]);
  });
  it("linking fills only empty fields", () => {
    const patch = I.fillBlanks({ brand: "Bor", full_name: "Noma'lum (qo'ng'iroq)", product_types: [] }, { amo_id: 5, brand: "Yangi", region: "Andijon", full_name: "Ali", product_types: ["Paket"], estimated_amount: 0, assigned_to_email: "" });
    expect(patch).toEqual({ amo_ids: [5], amo_id: 5, region: "Andijon", full_name: "Ali", product_types: ["Paket"] });
    expect(I.fillBlanks({ amo_id: 4, amo_ids: [4] }, { amo_id: 5, product_types: [] })).toEqual({ amo_ids: [4, 5] });
  });
});
