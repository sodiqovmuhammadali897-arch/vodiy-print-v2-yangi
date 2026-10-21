import { NavLink } from "react-router-dom";
import { Settings as SettingsIcon, Sparkles, Smartphone } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { offerApk, visibleNav } from "./nav";

// Computers only — phones use the tab bar (TabBar.tsx).
export default function Sidebar() {
  const auth = useAuth();
  const visibleItems = visibleNav(auth);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-ink-100 bg-surface lg:flex">
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
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
        {/* Everyone: own notifications and the app; admins also the company tabs. */}
        <NavLink
          to="/settings"
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
      </nav>

      <div className="border-t border-ink-100 p-4">
        {offerApk && (
          <a
            href="/app.apk"
            download="Vodiyprint.apk"
            className="mb-3 flex items-center gap-3 rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Smartphone className="text-brand-600" style={{ width: 18, height: 18 }} />
            <span>
              Android ilovani yuklab olish
              <span className="block text-[11px] font-normal text-ink-500">Vodiyprint · APK</span>
            </span>
          </a>
        )}
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
  );
}
