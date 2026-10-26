import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Suspense, useLayoutEffect, useRef } from "react";
import { Loader } from "lucide-react";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import Topbar from "./Topbar";
import ErrorBoundary from "../ErrorBoundary";
import PushBanner from "./PushBanner";
import OfflineBanner from "./OfflineBanner";
import UpdateBar from "./UpdateBar";
import { useAuth } from "../../lib/AuthContext";
import { useActivityHeartbeat } from "../../lib/activityTracking";
import { useWarmup } from "../../lib/warmup";
import { restoresScroll, savedScroll } from "../../lib/pageTransition";

export default function Layout() {
  const { user, staff } = useAuth();
  const location = useLocation();
  useActivityHeartbeat(user?.email?.toLowerCase() || null, staff?.full_name || "");
  useWarmup();
  // A section comes back where it was left (from the menu, a tab or
  // «orqaga»); a page opened from inside one starts at its top. Runs before
  // the page is drawn, so the page transition already shows the right spot.
  const main = useRef<HTMLElement>(null);
  const navigationType = useNavigationType();
  const path = useRef(location.pathname);
  const restoring = useRef(false);
  useLayoutEffect(() => {
    const el = main.current;
    if (!el) return;
    path.current = location.pathname;
    const target = restoresScroll(location.pathname, navigationType) ? savedScroll.get(location.pathname) || 0 : 0;
    el.scrollTo({ top: target });
    if (Math.abs(el.scrollTop - target) < 2) return;
    // A list still loading is too short at first: keep trying until it is
    // tall enough, the person scrolls, or 1.5 s pass.
    restoring.current = true;
    const start = performance.now();
    let frame = 0;
    const stop = () => {
      restoring.current = false;
      cancelAnimationFrame(frame);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
    };
    const tick = () => {
      el.scrollTo({ top: target });
      if (Math.abs(el.scrollTop - target) < 2 || performance.now() - start > 1500) return stop();
      frame = requestAnimationFrame(tick);
    };
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    frame = requestAnimationFrame(tick);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const remember = () => {
    if (!restoring.current && main.current) savedScroll.set(path.current, main.current.scrollTop);
  };
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <OfflineBanner />
        <UpdateBar />
        <main ref={main} onScroll={remember} className="vt-page flex-1 overflow-y-auto bg-ink-50 pb-[var(--tabbar)]">
          {/* Keyed by the page, so each opened page slides in where the
              browser has no View Transitions. */}
          <div key={location.pathname} className="page-enter mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            {!(location.pathname === "/settings" && location.hash === "#notifications") && <PushBanner email={user?.email?.toLowerCase() || ""} />}
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-ink-500">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
              }
            >
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </Suspense>
          </div>
        </main>
      </div>
      <TabBar />
    </div>
  );
}
