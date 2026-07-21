import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useState } from "react";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
