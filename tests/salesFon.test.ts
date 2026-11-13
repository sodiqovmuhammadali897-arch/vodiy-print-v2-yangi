import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FON_DEFAULT,
  fitSize,
  fonCss,
  loadFon,
  saveFon,
} from "../src/lib/salesFon";

describe("Sotuv bo'limi background", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("turns a choice into CSS", () => {
    expect(fonCss({ key: "aurora", glass: 0.5 })).toBe("url(/fon/aurora.svg)");
    expect(fonCss({ key: "hills", glass: 0.5 })).toBe(
      "linear-gradient(rgb(2 6 23 / 0.5), rgb(2 6 23 / 0.5)), url(/fon/hills.svg)",
    );
    expect(
      fonCss({
        key: "custom",
        custom: "data:image/jpeg;base64,AA",
        glass: 0.5,
      }),
    ).toContain('url("data:image/jpeg;base64,AA")');
    expect(fonCss({ key: "custom", glass: 0.5 })).toBe("");
    expect(fonCss({ key: "none", glass: 0.5 })).toBe("");
  });
  it("keeps each person's choice, and survives a browser that refuses", () => {
    const mem: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => void (mem[k] = v),
    });
    expect(saveFon("a@vp.uz", { key: "sea", glass: 2 })).toBe(true);
    expect(loadFon("a@vp.uz")).toEqual({
      key: "sea",
      custom: undefined,
      glass: 0.85,
    });
    expect(loadFon("b@vp.uz")).toEqual(FON_DEFAULT);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("no");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(loadFon("a@vp.uz")).toEqual(FON_DEFAULT);
    expect(saveFon("a@vp.uz", { key: "sea", glass: 0.5 })).toBe(false);
  });
  it("makes a big photo smaller", () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1920, h: 1440 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
