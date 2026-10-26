import { describe, expect, it } from "vitest";
import { navKind, restoresScroll } from "../src/lib/pageTransition";

const tabs = ["/dashboard", "/leads", "/orders", "/customers"];

describe("navKind", () => {
  it("slides a tab in from the side it sits on", () => {
    expect(navKind("/dashboard", "/orders", "PUSH", tabs, false)).toBe("tab-right");
    expect(navKind("/customers", "/leads", "PUSH", tabs, false)).toBe("tab-left");
    expect(navKind("/orders/12", "/dashboard", "PUSH", tabs, false)).toBe("tab-left");
  });

  it("pushes a deeper page in and slides it back out", () => {
    expect(navKind("/orders", "/orders/12", "PUSH", tabs, false)).toBe("push");
    expect(navKind("/orders/12", "/orders", "POP", tabs, false)).toBe("pop");
    expect(navKind("/orders/12", "/orders/12/edit", "PUSH", tabs, false)).toBe("push");
  });

  it("uses the history direction between pages of the same depth", () => {
    expect(navKind("/settings", "/products", "PUSH", tabs, false)).toBe("push");
    expect(navKind("/products", "/settings", "POP", tabs, false)).toBe("pop");
  });

  it("fades into a tab from a page outside the tab bar", () => {
    expect(navKind("/settings", "/orders", "PUSH", tabs, false)).toBe("fade");
  });

  it("always fades on a computer", () => {
    expect(navKind("/dashboard", "/orders", "PUSH", tabs, true)).toBe("fade");
    expect(navKind("/orders", "/orders/12", "PUSH", tabs, true)).toBe("fade");
  });
});

describe("restoresScroll", () => {
  it("brings sections and «orqaga» back to where they were", () => {
    expect(restoresScroll("/orders", "PUSH")).toBe(true);
    expect(restoresScroll("/orders/12", "POP")).toBe(true);
    expect(restoresScroll("/orders/12", "PUSH")).toBe(false);
  });
});
