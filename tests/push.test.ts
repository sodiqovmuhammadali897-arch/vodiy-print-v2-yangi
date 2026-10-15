import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const P = require("../meta-webhook/push");

describe("push notifications", () => {
  it("turns a Telegram text into a title and a body", () => {
    expect(P.fromText("⏰ Eslatma:\nTa'minotga qo'ng'iroq\n\n— qog'oz narxi")).toEqual({ title: "⏰ Eslatma:", body: "Ta'minotga qo'ng'iroq\n— qog'oz narxi" });
    expect(P.fromText("")).toEqual({ title: "Vodiyprint", body: "" });
    expect(P.fromText("x".repeat(500)).title.length).toBe(80);
  });

  it("does nothing before init", async () => {
    await expect(P.toEmail("a@b.uz", "tasks", "Salom")).resolves.toBe(0);
    await expect(P.toChat(123, "tasks", "Salom")).resolves.toBeUndefined();
    await expect(P.toAdmins("admin", "Salom")).resolves.toBeUndefined();
  });
});
