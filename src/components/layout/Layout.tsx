import { Outlet, useLocation } from "react-router-dom";
import { Suspense, useState } from "react";
import { Loader } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ErrorBoundary from "../ErrorBoundary";
import { useAuth } from "../../lib/AuthContext";
import { useActivityHeartbeat } from "../../lib/activityTracking";
import { useWarmup } from "../../lib/warmup";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, staff } = useAuth();
  const location = useLocation();
  useActivityHeartbeat(user?.email?.toLowerCase() || null, staff?.full_name || "");
  useWarmup();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
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
    </div>
  );
}
