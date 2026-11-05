import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lossOf, toLead } = require("../meta-webhook/amocrm");

const field = (name: string, value: string, id = 304899) => ({ field_id: id, field_name: name, values: [{ value }] });

describe("amoCRM loss reason", () => {
  it("reads the built-in reason first, then the «Ёпилиш сабаби» field", () => {
    expect(lossOf({ _embedded: { loss_reason: [{ name: "Слишком дорого" }] }, custom_fields_values: [field("Ёпилиш сабаби", "Нарх қиммат")] })).toBe("Слишком дорого");
    expect(lossOf({ custom_fields_values: [field("Вилоят", "Фарғона", 1), field("Ёпилиш сабаби", " Рақобатчи танланди ")] })).toBe("Рақобатчи танланди");
    expect(lossOf({ custom_fields_values: [field("Вилоят", "Фарғона", 1)] })).toBeNull();
    expect(lossOf({})).toBeNull();
  });

  it("can pick the field by id", () => {
    expect(lossOf({ custom_fields_values: [field("Boshqa", "Qimmat", 55)] }, 55)).toBe("Qimmat");
  });

  it("keeps it on the lead", () => {
    expect(toLead({ id: 1, status_id: 143, custom_fields_values: [field("Ёпилиш сабаби", "Нарх қиммат")] }, new Map()).loss).toBe("Нарх қиммат");
  });
});
