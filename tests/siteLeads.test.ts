import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const S = require("../meta-webhook/siteLeads");

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("site lead form", () => {
  it("normalises Uzbek phone numbers", () => {
    expect(S.normPhone("+998 90 123-45-67")).toBe("+998901234567");
    expect(S.normPhone("90 1234567")).toBe("+998901234567");
    expect(S.normPhone("998901234567")).toBe("+998901234567");
    expect(S.normPhone("12345")).toBeNull();
    expect(S.normPhone("")).toBeNull();
  });

  it("accepts a filled form", () => {
    const out = S.parseLead({ name: "  Aziz  ", phone: "90 123 45 67", product: "Paket", qty: "500 dona", note: "logotip bilan" });
    expect(out.lead).toEqual({ name: "Aziz", phone: "+998901234567", product: "Paket", qty: "500 dona", note: "logotip bilan" });
    expect(out.file).toBeNull();
  });

  it("asks for a name and a full phone", () => {
    expect(S.parseLead({ name: "", phone: "901234567" }).error).toMatch(/Ism/);
    expect(S.parseLead({ name: "Aziz", phone: "90 12" }).error).toMatch(/Telefon/);
  });

  it("treats the hidden field as spam", () => {
    expect(S.parseLead({ name: "Bot", phone: "901234567", website: "http://x" })).toEqual({ spam: true });
  });

  it("files an unknown product under Boshqa", () => {
    expect(S.parseLead({ name: "A", phone: "901234567", product: "<script>" }).lead.product).toBe("Boshqa");
  });

  it("takes a logo file and rejects other types", () => {
    const ok = S.parseLead({ name: "A", phone: "901234567", file: { name: "logo (1)/.png", type: "image/png", data: b64("png") } });
    expect(ok.file.buf.toString()).toBe("png");
    expect(ok.file.name).toBe("logo _1__.png");
    expect(S.parseLead({ name: "A", phone: "901234567", file: { name: "x.exe", type: "application/x-msdownload", data: b64("MZ") } }).error).toMatch(/Fayl turi/);
  });

  it("writes the Telegram notice", () => {
    const text = S.leadText({ name: "Aziz", phone: "+998901234567", product: "Paket", qty: "500", note: "" }, "abcdef123");
    expect(text).toContain("🌐 Saytdan yangi ariza");
    expect(text).toContain("📦 Paket · 500");
    expect(text).not.toContain("💬");
    expect(text).toContain("#sayt abcdef");
  });
});
