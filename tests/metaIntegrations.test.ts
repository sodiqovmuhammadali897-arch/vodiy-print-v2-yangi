import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const A = require("../meta-webhook/assign");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const T = require("../meta-webhook/metaToken");

describe("new internet leads go to the managers in turn", () => {
  const staff = [
    { id: "nuriddin@vp.uz", full_name: "Nuriddin", report_manager_id: "m2" },
    { id: "diyor@vp.uz", full_name: "Muhammaddiyor", report_manager_id: "m1" },
    { id: "maryam@vp.uz", full_name: "Maryam", permissions: { leads: { edit: true } } },
    { id: "owner@vp.uz", full_name: "Owner", role: "admin", permissions: { leads: { edit: true } } },
    { id: "old@vp.uz", full_name: "Old", report_manager_id: "m9", active: false },
    { id: "prod@vp.uz", full_name: "Dilmurodjon", permissions: { orders: { edit: true } } },
  ];
  it("takes the named sellers only", () => {
    const more = [...staff, { id: "test@vp.uz", full_name: "test", permissions: { leads: { edit: true } } }, { id: "jamila@vp.uz", full_name: "Jamila", permissions: { leads: { edit: true } } }];
    expect(A.pool(more, "Muhammadiyor,Maryam,Nuriddin").map((s: { name: string }) => s.name)).toEqual(["Muhammaddiyor", "Maryam", "Nuriddin"]);
    expect(A.pool(more, "Nuriddin, Nobody").map((s: { name: string }) => s.name)).toEqual(["Nuriddin"]);
    expect(A.pool(more, "Old")).toEqual([]); // inactive
  });
  it("goes round, preferring who is at work", () => {
    const p = A.pool(staff);
    expect(A.pickNext(p, "").email).toBe("diyor@vp.uz");
    expect(A.pickNext(p, "diyor@vp.uz").email).toBe("maryam@vp.uz");
    expect(A.pickNext(p, "maryam@vp.uz").email).toBe("nuriddin@vp.uz");
    expect(A.pickNext(p, "nuriddin@vp.uz").email).toBe("diyor@vp.uz");
    const atWork = new Set(["nuriddin@vp.uz", "diyor@vp.uz"]);
    expect(A.pickNext(p, "diyor@vp.uz", atWork).email).toBe("nuriddin@vp.uz");
    expect(A.pickNext(p, "nuriddin@vp.uz", atWork).email).toBe("diyor@vp.uz");
    expect(A.pickNext([], "")).toBeNull();
  });
});

describe("one Meta key", () => {
  it("picks the Page with Instagram, or the one asked for", () => {
    const pages = [
      { id: "1", name: "Old page", access_token: "a" },
      { id: "2", name: "Vodiy Print", access_token: "b", instagram_business_account: { username: "vp" } },
      { id: "3", name: "No token" },
    ];
    expect(T.pickPage(pages).id).toBe("2");
    expect(T.pickPage(pages, "1").id).toBe("1");
    expect(T.pickPage([])).toBeNull();
  });
  it("prefers an active ad account", () => {
    expect(T.pickAdAccount([{ id: "act_1", account_status: 2 }, { id: "act_2", account_status: 1 }]).id).toBe("act_2");
    expect(T.pickAdAccount([])).toBeNull();
  });
  it("rewrites .env lines without touching the rest", () => {
    const env = "PORT=8081\nMETA_PAGE_ACCESS_TOKEN=x\nMETA_ADS_TOKEN=\n";
    const out = T.setEnv(env, { META_PAGE_ACCESS_TOKEN: "page", META_ADS_TOKEN: "sys", META_AD_ACCOUNT_ID: "act_2" });
    expect(T.parseEnv(out)).toEqual({ PORT: "8081", META_PAGE_ACCESS_TOKEN: "page", META_ADS_TOKEN: "sys", META_AD_ACCOUNT_ID: "act_2" });
    expect(out.endsWith("\n")).toBe(true);
  });
});
