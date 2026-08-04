import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, Users, Tag, FileText, Shirt, Warehouse, Wallet, ChartBar as BarChart3, Palette, Settings as SettingsIcon, X, Sparkles } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import type { ModuleKey } from "../../lib/permissions";

const navItems = [
  { to: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard, module: "dashboard" as ModuleKey },
  { to: "/orders", label: "Buyurtmalar", icon: Package, module: "orders" as ModuleKey },
  { to: "/customers", label: "Mijozlar", icon: Users, module: "customers" as ModuleKey },
  { to: "/brands", label: "Brendlar", icon: Tag, module: "brands" as ModuleKey },
  { to: "/proposals", label: "Tijorat taklifi", icon: FileText, module: "proposals" as ModuleKey },
  { to: "/design", label: "Dizayn", icon: Palette, module: "design" as ModuleKey },
  { to: "/textile", label: "Textil", icon: Shirt, module: "textile" as ModuleKey },
  { to: "/warehouse", label: "Ombor", icon: Warehouse, module: "warehouse" as ModuleKey },
  { to: "/finance", label: "Moliya", icon: Wallet, module: "finance" as ModuleKey },
  { to: "/reports", label: "Hisobot", icon: BarChart3, module: "reports" as ModuleKey },
];

type Props = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({ mobileOpen, onCloseMobile }: Props) {
  const { isAdmin, can } = useAuth();
  const visibleItems = navItems.filter(
    (item) => isAdmin || can(item.module, "view"),
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink-100 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-base font-bold text-ink-900">
                Poligrafiya ERP
              </div>
              <div className="text-[11px] font-medium text-ink-500">
                Farg'ona vodiysi
              </div>
            </div>
          </div>
          <button
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={onCloseMobile}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4.5 w-4.5 ${
                      isActive ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"
                    }`}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/settings"
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <SettingsIcon
                    className={`h-4.5 w-4.5 ${
                      isActive ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"
                    }`}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Sozlamalar</span>
                </>
              )}
            </NavLink>
          )}
        </nav>

        <div className="border-t border-ink-100 p-4">
          <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Jamoa
            </div>
            <p className="mt-1 text-sm leading-snug">
              Farg'ona vodiysining eng yaxshi poligrafiyasini birgalikda quramiz.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
