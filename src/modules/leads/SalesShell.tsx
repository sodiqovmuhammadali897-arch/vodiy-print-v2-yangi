import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, CheckSquare, LayoutDashboard, Phone, Rows3 } from "lucide-react";
import { useCrm } from "./crm/useCrm";
import CrmHome from "./crm/CrmHome";
import LeadsBoard from "./crm/LeadsBoard";
import CallsLog from "./CallsLog";
import LeadDrawer from "./crm/LeadDrawer";
import SalesControl from "./SalesControl";
import SalesFunnel from "./SalesFunnel";
import LostDeals from "./LostDeals";
import { boardStats, isOldLead } from "../../lib/crm";

// Sotuv bo'limi in amoCRM's order (the owner's deck «Sotuv bo'limi — yangi
// tartib», 2026-11-25; «amodan to'liq 1 oy ichida ERPga o'tamiz»): five
// sections in a left menu, one place for each thing. The ERP's leads,
// tasks and calls are read once here for every section. «Tahlil» keeps
// the amoCRM reports for the month of the move.
export type SalesSection = "home" | "lidlar" | "zadachalar" | "qongiroqlar" | "tahlil";
type TahlilTab = "voronka" | "yutqazilgan" | "nazorat" | "amo";

const SECTIONS: { key: SalesSection; label: string; icon: ReactNode }[] = [
  { key: "home", label: "Bosh sahifa", icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: "lidlar", label: "Lidlar", icon: <Rows3 className="h-4 w-4" /> },
  { key: "zadachalar", label: "Zadachalar", icon: <CheckSquare className="h-4 w-4" /> },
  { key: "qongiroqlar", label: "Qo'ng'iroqlar", icon: <Phone className="h-4 w-4" /> },
  { key: "tahlil", label: "Tahlil", icon: <BarChart3 className="h-4 w-4" /> },
];
const TAHLIL: { key: TahlilTab; label: string }[] = [
  { key: "voronka", label: "Voronka" },
  { key: "yutqazilgan", label: "Yo'qotilganlar" },
  { key: "nazorat", label: "Menejerlar kuni" },
  { key: "amo", label: "amoCRM hisobotlari" },
];

// Old links (?v=voronka …) land in the new place.
export function sectionOf(v: string | null): { section: SalesSection; tab: TahlilTab } {
  if (v === "lidlar" || v === "zadachalar" || v === "qongiroqlar" || v === "home") return { section: v, tab: "voronka" };
  if (v === "voronka" || v === "yutqazilgan" || v === "nazorat" || v === "amo") return { section: "tahlil", tab: v };
  if (v === "control") return { section: "tahlil", tab: "nazorat" };
  if (v === "tahlil") return { section: "tahlil", tab: "voronka" };
  return { section: "home", tab: "voronka" };
}

export default function SalesShell({ amo, fonButton }: { amo: ReactNode; fonButton: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const v = params.get("v");
  const t = params.get("t");
  const { section, tab: fromV } = sectionOf(v);
  const tab = (TAHLIL.find((x) => x.key === t)?.key || fromV) as TahlilTab;
  const crm = useCrm();
  // Phones: the menu is a row that scrolls — keep the chosen item in view.
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = activeRef.current;
    const row = el?.parentElement;
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [section]);
  // ?lead=ID: the lead's card in the right-side panel (step 2).
  const leadId = params.get("lead");
  const closeLead = () => {
    // Opened by a click (history has it): go back, so the phone's «orqaga» and
    // the close button do the same; a pasted link just drops the parameter.
    if (window.history.state && window.history.state.idx > 0) window.history.back();
    else {
      const p = new URLSearchParams(params);
      p.delete("lead");
      setParams(p, { replace: true });
    }
  };
  const go = (s: SalesSection, nextTab?: TahlilTab) => setParams(s === "home" ? {} : nextTab ? { v: s, t: nextTab } : { v: s }, { replace: true });

  // Badges: new leads nobody took, tasks late or due today.
  const stats = useMemo(() => boardStats((crm.leads || []).filter((l) => !isOldLead(l)), crm.tasks, crm.orders), [crm.leads, crm.tasks, crm.orders]);
  const unassigned = useMemo(() => (crm.leads || []).filter((l) => !isOldLead(l) && !l.assigned_to_email && l.status === "new").length, [crm.leads]);
  const badge: Partial<Record<SalesSection, number>> = { lidlar: unassigned, zadachalar: stats.late + stats.tasksToday };

  const body =
    section === "home" ? (
      crm.leads ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">Bosh sahifa</h1>
            <p className="text-sm text-ink-500">Bugungi lidlar, zadachalar va qo'ng'iroqlar. Raqamni bossangiz, ro'yxati ochiladi.</p>
          </div>
          <CrmHome leads={crm.leads} tasks={crm.tasks} orders={crm.orders} sellers={crm.sellers} actor={crm.actor} isAdmin={crm.isAdmin} email={crm.email} />
        </div>
      ) : (
        <div className="h-40 animate-pulse rounded-3xl bg-ink-100/70" />
      )
    ) : section === "lidlar" ? (
      <LeadsBoard mode="board" crm={crm} />
    ) : section === "zadachalar" ? (
      <LeadsBoard mode="tasks" crm={crm} />
    ) : section === "qongiroqlar" ? (
      <CallsLog sellers={crm.sellers} />
    ) : (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 font-display text-2xl font-bold text-ink-900">Tahlil</h1>
          <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-ink-200 bg-surface p-1">
            {TAHLIL.map((x) => (
              <button key={x.key} type="button" onClick={() => go("tahlil", x.key)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === x.key ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-900"}`}>
                {x.label}
              </button>
            ))}
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">amoCRM ma'lumoti · o'tish oyida</span>
        </div>
        {tab === "voronka" ? <SalesFunnel /> : tab === "yutqazilgan" ? <LostDeals /> : tab === "nazorat" ? <SalesControl /> : amo}
      </div>
    );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <nav className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 lg:sticky lg:top-4 lg:mx-0 lg:w-48 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:border-ink-100 lg:bg-surface lg:p-2 lg:shadow-sm" aria-label="Sotuv bo'limi">
        <div className="hidden px-3 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400 lg:block">Sotuv bo'limi</div>
        {SECTIONS.map((s) => {
          const on = s.key === section;
          const n = badge[s.key] || 0;
          return (
            <button
              key={s.key}
              ref={on ? activeRef : undefined}
              type="button"
              onClick={() => go(s.key)}
              aria-current={on ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${on ? "bg-brand-600 text-white shadow-sm" : "bg-surface text-ink-600 hover:bg-ink-50 hover:text-ink-900 lg:bg-transparent"}`}
            >
              {s.icon}
              <span>{s.label}</span>
              {n > 0 && <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white/25 text-white" : "bg-rose-500 text-white"}`}>{n}</span>}
            </button>
          );
        })}
        <div className="shrink-0 lg:mt-2 lg:border-t lg:border-ink-100 lg:pt-2">{fonButton}</div>
      </nav>
      <div className="min-w-0 flex-1">{body}</div>
      {leadId && <LeadDrawer id={leadId} crm={crm} onClose={closeLead} />}
    </div>
  );
}
