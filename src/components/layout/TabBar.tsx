import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CircleEllipsis } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { pickTabs, tabOf } from "../../lib/tabBar";
import { preloadRoute } from "../../pages";
import { setNavTabs } from "../../lib/pageTransition";
import { visibleNav } from "./nav";
import MoreSheet from "./MoreSheet";

// Short names that fit under a tab's icon.
const SHORT: Record<string, string> = {
  "/leads": "Sotuv",
  "/proposals": "Taklif",
  "/production": "Ishlab chiq.",
  "/attendance": "Davomat",
};

const scrollPageTop = () => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });

// Phones: four pages that fit the person's work at the bottom, the rest in
// the «Yana» sheet. Computers keep the sidebar.
export default function TabBar() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = visibleNav(auth);
  const tabs = pickTabs(
    items.map((i) => i.to),
    auth.isAdmin && !auth.isManagerAccount,
  );
  const tabItems = tabs.map((t) => items.find((i) => i.to === t)!).filter(Boolean);
  const active = tabOf(pathname, tabs);
  const [moreOpen, setMoreOpen] = useState(false);
  setNavTabs(tabs);

  // The phone's back button closes the sheet instead of leaving the page.
  useEffect(() => {
    if (!moreOpen) return;
    const onPop = () => setMoreOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [moreOpen]);

  const openMore = () => {
    window.history.pushState({ ...window.history.state, moreSheet: true }, "");
    setMoreOpen(true);
  };
  const closeMore = () => {
    if (window.history.state?.moreSheet) window.history.back();
    else setMoreOpen(false);
  };
  // The sheet's history entry becomes the chosen page, so back returns to
  // where the person was before opening «Yana».
  const pick = (to: string) => {
    setMoreOpen(false);
    navigate(to, { replace: Boolean(window.history.state?.moreSheet) });
  };

  return (
    <>
      <nav
        className="vt-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/70 bg-surface/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Bo'limlar"
      >
        <div className="flex h-16">
          {tabItems.map(({ to, label, icon: Icon }) => {
            const on = active === to && !moreOpen;
            return (
              <NavLink
                key={to}
                to={to}
                onPointerDown={() => preloadRoute(to)}
                onClick={() => on && pathname === to && scrollPageTop()}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors ${on ? "text-brand-600" : "text-ink-400"}`}
              >
                <Icon key={on ? "on" : "off"} className={on ? "tab-pop" : ""} style={{ width: 24, height: 24 }} strokeWidth={on ? 2.3 : 1.9} />
                <span className="max-w-full truncate px-0.5">{SHORT[to] || label}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => (moreOpen ? closeMore() : openMore())}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors ${moreOpen || !active ? "text-brand-600" : "text-ink-400"}`}
          >
            <CircleEllipsis key={moreOpen ? "on" : "off"} className={moreOpen ? "tab-pop" : ""} style={{ width: 24, height: 24 }} strokeWidth={moreOpen ? 2.3 : 1.9} />
            <span>Yana</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} items={items.filter((i) => !tabs.includes(i.to))} current={pathname} onClose={closeMore} onPick={pick} />
    </>
  );
}
