import { LayoutDashboard, Target, Package, Users, Boxes, FileText, Shirt, Warehouse, Wallet, ChartBar as BarChart3, Printer, Stamp, Fingerprint, ClipboardList, Bot, Percent, Megaphone, Clapperboard, Coins, BookOpen } from "lucide-react";
import { canViewMargin } from "../../lib/rolePermissions";
import { canSeeOwnKpi, type ModuleKey } from "../../lib/permissions";
import type { useAuth as UseAuth } from "../../lib/AuthContext";

// The ERP's pages for the sidebar (computers) and the tab bar with its
// «Yana» sheet (phones).
export const navItems = [
  { to: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard, module: "dashboard" as ModuleKey },
  { to: "/leads", label: "Sotuv bo'limi", icon: Target, module: "leads" as ModuleKey },
  { to: "/darslik", label: "Darslik", icon: BookOpen, module: "leads" as ModuleKey },
  { to: "/ads", label: "Reklama", icon: Megaphone, module: "ads" as ModuleKey },
  { to: "/content", label: "Kontent", icon: Clapperboard, module: "ads" as ModuleKey },
  { to: "/orders", label: "Buyurtmalar", icon: Package, module: "orders" as ModuleKey },
  { to: "/customers", label: "Mijozlar", icon: Users, module: "customers" as ModuleKey },
  { to: "/products", label: "Mahsulotlar", icon: Boxes, module: "products" as ModuleKey },
  { to: "/proposals", label: "Tijorat taklifi", icon: FileText, module: "proposals" as ModuleKey },
  { to: "/production", label: "Ishlab chiqarish", icon: Printer, module: "production" as ModuleKey },
  { to: "/pechatnik", label: "Pechatnik", icon: Stamp, module: "pechatnik" as ModuleKey },
  { to: "/textile", label: "Textil", icon: Shirt, module: "textile" as ModuleKey },
  { to: "/warehouse", label: "Ombor", icon: Warehouse, module: "warehouse" as ModuleKey },
  { to: "/finance", label: "Moliya", icon: Wallet, module: "finance" as ModuleKey },
  { to: "/margin", label: "Marja", icon: Percent, module: "finance" as ModuleKey, adminOnly: true, costOnly: true },
  { to: "/kpi", label: "KPI", icon: Coins, module: "reports" as ModuleKey, adminOnly: true, costOnly: true },
  { to: "/reports", label: "Hisobot", icon: BarChart3, module: "reports" as ModuleKey },
  { to: "/ai-office", label: "AI Ofis", icon: Bot, module: "reports" as ModuleKey, adminOnly: true },
  { to: "/attendance", label: "Davomat va KPI", icon: Fingerprint, module: "attendance" as ModuleKey, kpiToo: true },
  { to: "/tasks", label: "Vazifalar", icon: ClipboardList, module: "tasks" as ModuleKey, everyone: true },
];

// The pages an account can open, in sidebar order. "Davomat va KPI" also
// opens for an account that only has "KPI" — the KPI tab lives there.
export function visibleNav(auth: ReturnType<typeof UseAuth>) {
  const { isAdmin, can, staff } = auth;
  return navItems.filter((item) =>
    "costOnly" in item && item.costOnly
      ? canViewMargin(auth)
      : isAdmin ||
        (!("adminOnly" in item && item.adminOnly) &&
          (("everyone" in item && item.everyone) || can(item.module, "view") || ("kpiToo" in item && item.kpiToo && canSeeOwnKpi(staff)))),
  );
}

// Android phones in the browser get a link to the Vodiyprint app (built by
// .github/workflows/android.yml). The app opens the site with an
// android-app:// referrer — remembered for the tab, so it's hidden there.
const inApp = (() => {
  const fromApp = document.referrer.startsWith("android-app://");
  try {
    if (fromApp) sessionStorage.setItem("vp_in_app", "1");
    return sessionStorage.getItem("vp_in_app") === "1";
  } catch {
    return fromApp;
  }
})();
export const offerApk = /Android/i.test(navigator.userAgent) && !inApp;

