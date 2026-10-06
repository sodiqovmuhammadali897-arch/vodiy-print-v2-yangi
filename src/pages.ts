import { lazy } from "react";

// Each page's code is its own file, fetched the first time the page is
// opened — that first visit showed a spinner. After sign-in the browser
// fetches them all in the background (prefetchPages), so switching pages
// does not wait for code.
const loaders = {
  SalesPipeline: () => import("./modules/leads/SalesPipeline"),
  AdsPage: () => import("./modules/ads/AdsPage"),
  ContentPage: () => import("./modules/content/ContentPage"),
  Orders: () => import("./modules/orders/Orders"),
  OrderDetail: () => import("./modules/orders/OrderDetail"),
  OrderWizard: () => import("./modules/orders/wizard/OrderWizard"),
  Customers: () => import("./modules/customers/Customers"),
  CustomerDetail: () => import("./modules/customers/CustomerDetail"),
  Products: () => import("./modules/products/ProductsPage"),
  Proposals: () => import("./modules/proposals/Proposals"),
  ProposalEditor: () => import("./modules/proposals/ProposalEditor"),
  Textile: () => import("./modules/textile/Textile"),
  Warehouse: () => import("./modules/warehouse/Warehouse"),
  Finance: () => import("./modules/finance/Finance"),
  Reports: () => import("./modules/reports/Reports"),
  MarginPage: () => import("./modules/margin/MarginPage"),
  KpiBonusPage: () => import("./modules/kpi/KpiBonusPage"),
  AiOffice: () => import("./modules/aioffice/AiOffice"),
  Production: () => import("./modules/production/Production"),
  Pechatnik: () => import("./modules/production/Pechatnik"),
  AttendancePage: () => import("./modules/attendance/AttendancePage"),
  Tasks: () => import("./modules/tasks/Tasks"),
  Settings: () => import("./modules/settings/Settings"),
};

export const pages = Object.fromEntries(Object.entries(loaders).map(([k, load]) => [k, lazy(load)])) as {
  [K in keyof typeof loaders]: ReturnType<typeof lazy<Awaited<ReturnType<(typeof loaders)[K]>>["default"]>>;
};

// The 3D office is heavy and rarely opened — it stays on demand.
const SKIP = new Set<keyof typeof loaders>(["AiOffice"]);

let prefetched = false;
export const prefetchPages = (): void => {
  if (prefetched) return;
  prefetched = true;
  const keys = (Object.keys(loaders) as (keyof typeof loaders)[]).filter((k) => !SKIP.has(k));
  // One at a time, so the page being used keeps the connection first.
  const next = () => {
    const k = keys.shift();
    if (!k) return;
    loaders[k]()
      .catch(() => undefined)
      .finally(() => setTimeout(next, 50));
  };
  next();
};
