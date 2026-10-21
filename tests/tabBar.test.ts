import { describe, expect, it } from "vitest";
import { pickTabs, tabOf } from "../src/lib/tabBar";

const ALL = ["/dashboard", "/leads", "/darslik", "/orders", "/customers", "/products", "/production", "/finance", "/reports", "/tasks"];

describe("phone tab bar", () => {
  it("gives each kind of work its own four pages", () => {
    expect(pickTabs(ALL, true)).toEqual(["/dashboard", "/orders", "/finance", "/reports"]);
    expect(pickTabs(ALL, false)).toEqual(["/dashboard", "/leads", "/orders", "/customers"]);
    expect(pickTabs(["/dashboard", "/production", "/orders", "/tasks", "/products"], false)).toEqual(["/dashboard", "/production", "/orders", "/tasks"]);
  });

  it("fills up with what the person can open", () => {
    expect(pickTabs(["/leads", "/darslik", "/customers", "/products", "/tasks"], false)).toEqual(["/leads", "/customers", "/tasks", "/darslik"]);
    expect(pickTabs(["/tasks"], false)).toEqual(["/tasks"]);
  });

  it("finds the tab of a nested page", () => {
    const tabs = ["/dashboard", "/orders"];
    expect(tabOf("/orders/abc", tabs)).toBe("/orders");
    expect(tabOf("/orders", tabs)).toBe("/orders");
    expect(tabOf("/ordersx", tabs)).toBeNull();
    expect(tabOf("/finance", tabs)).toBeNull();
  });
});
