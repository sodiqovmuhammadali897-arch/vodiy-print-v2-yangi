import { useEffect, useRef, useState } from "react";
import { Settings as SettingsIcon, Smartphone } from "lucide-react";
import { preloadRoute } from "../../pages";
import { navItems, offerApk } from "./nav";

type Item = (typeof navItems)[number];

// Each page's tile colour in the sheet, like app icons on a phone.
const TILE: Record<string, string> = {
  "/dashboard": "#0062db",
  "/leads": "#e11d48",
  "/darslik": "#2563eb",
  "/ads": "#f97316",
  "/content": "#db2777",
  "/orders": "#0891b2",
  "/customers": "#7c3aed",
  "/products": "#0ea5e9",
  "/proposals": "#6366f1",
  "/production": "#f59e0b",
  "/pechatnik": "#d97706",
  "/textile": "#ec4899",
  "/warehouse": "#14b8a6",
  "/finance": "#10b981",
  "/margin": "#059669",
  "/kpi": "#ca8a04",
  "/reports": "#64748b",
  "/ai-office": "#334155",
  "/attendance": "#8b5cf6",
  "/tasks": "#ef4444",
  "/settings": "#475569",
};

const CLOSE_DRAG_PX = 110;

type Props = {
  open: boolean;
  items: Item[];
  current: string;
  onClose: () => void;
  onPick: (to: string) => void;
};

// «Yana»: the pages that aren't in the tab bar, as a grid of tiles in a
// sheet that slides up. Closes on a tile, a tap outside, dragging the
// handle down or the phone's back button.
export default function MoreSheet({ open, items, current, onClose, onPick }: Props) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setDy(0);
  }, [open]);

  const onEnd = () => {
    if (start.current === null) return;
    start.current = null;
    if (dy > CLOSE_DRAG_PX) onClose();
    else setDy(0);
  };

  const tiles = [...items.map((i) => ({ to: i.to, label: i.label, icon: i.icon })), { to: "/settings", label: "Sozlamalar", icon: SettingsIcon }];

  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-ink-900/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Barcha bo'limlar"
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2 shadow-2xl"
        style={{
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          transform: open ? `translateY(${dy}px)` : "translateY(105%)",
          transition: start.current === null ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)" : "none",
        }}
        ref={sheet}
        // Drag down only from the top of the sheet, not while scrolling it.
        onTouchStart={(e) => (start.current = (sheet.current?.scrollTop || 0) > 0 ? null : e.touches[0].clientY)}
        onTouchMove={(e) => start.current !== null && setDy(Math.max(0, e.touches[0].clientY - start.current))}
        onTouchEnd={onEnd}
      >
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-ink-300" />
        <div className="mb-4 font-display text-lg font-bold text-ink-900">Barcha bo'limlar</div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-4">
          {tiles.map(({ to, label, icon: Icon }, i) => {
            const on = current === to || current.startsWith(to + "/");
            return (
              <button
                key={to}
                onPointerDown={() => preloadRoute(to)}
                onClick={() => onPick(to)}
                className="flex flex-col items-center gap-1.5 text-center transition-transform active:scale-90"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : "translateY(12px)",
                  transition: `opacity 260ms ${open ? 60 + i * 18 : 0}ms, transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1) ${open ? 60 + i * 18 : 0}ms`,
                }}
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm ${on ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-surface" : ""}`}
                  style={{ background: TILE[to] || "#64748b" }}
                >
                  <Icon style={{ width: 26, height: 26 }} />
                </span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink-700">{label}</span>
              </button>
            );
          })}
        </div>
        {offerApk && (
          <a
            href="/app.apk"
            download="Vodiyprint.apk"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-ink-200 px-4 py-3 text-sm font-medium text-ink-700"
          >
            <Smartphone className="text-brand-600" style={{ width: 20, height: 20 }} />
            <span>
              Android ilovani yuklab olish
              <span className="block text-[11px] font-normal text-ink-500">Vodiyprint · APK</span>
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
