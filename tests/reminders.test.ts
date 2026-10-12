import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const R = require("../meta-webhook/reminders");

// Tashkent wall clock → ms.
const at = (s: string) => Date.parse(`${s}:00+05:00`);

describe("⏰ Eslatma", () => {
  const now = at("2026-10-12T14:20");

  it("turns the buttons into a moment", () => {
    expect(R.presetAt("30m", now)).toBe(at("2026-10-12T14:50"));
    expect(R.presetAt("2h", now)).toBe(at("2026-10-12T16:20"));
    expect(R.presetAt("t17", now)).toBe(at("2026-10-12T17:00"));
    expect(R.presetAt("d10", now)).toBe(at("2026-10-13T10:00"));
  });

  it("reads typed times", () => {
    expect(R.parseWhen("15:30", now)).toBe(at("2026-10-12T15:30"));
    expect(R.parseWhen("9.15", now)).toBe(at("2026-10-13T09:15")); // past today → tomorrow
    expect(R.parseWhen("ertaga 9:30", now)).toBe(at("2026-10-13T09:30"));
    expect(R.parseWhen("Bugun 18:00", now)).toBe(at("2026-10-12T18:00"));
    expect(R.parseWhen("14.10 11:00", now)).toBe(at("2026-10-14T11:00"));
    expect(R.parseWhen("1/11/2026 08:05", now)).toBe(at("2026-11-01T08:05"));
    expect(R.parseWhen("05.10 11:00", now)).toBe(at("2027-10-05T11:00")); // date passed → next year
    expect(R.parseWhen("25:00", now)).toBeNull();
    expect(R.parseWhen("ertalab", now)).toBeNull();
    expect(R.parseWhen("12.10.2026 10:00", now)).toBeNull(); // in the past
  });

  it("says when", () => {
    expect(R.whenLabel(at("2026-10-12T15:30"), now)).toBe("bugun 15:30");
    expect(R.whenLabel(at("2026-10-13T10:00"), now)).toBe("ertaga 10:00");
    expect(R.whenLabel(at("2026-10-20T09:05"), now)).toBe("20-oktyabr 09:05");
  });
});
