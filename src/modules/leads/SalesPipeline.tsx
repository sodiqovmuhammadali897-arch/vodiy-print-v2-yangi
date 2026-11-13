import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import AmoAnalyticsView from "./AmoAnalyticsView";
import LostDeals from "./LostDeals";
import SalesControl from "./SalesControl";
import SalesFunnel from "./SalesFunnel";
import LeadsBoard from "./crm/LeadsBoard";
import { FonButton, useSalesFon } from "./SalesFon";

// Sotuv bo'limi: leads are worked in amoCRM, the ERP shows the numbers.
// Admins open on «Nazorat» — every manager's day on one page
// (SalesControl) — next to the amoCRM analysis (AmoAnalyticsView,
// meta-webhook/amocrm.js); everyone else sees their own amoCRM numbers.
export default function SalesPipeline() {
  const { isAdmin, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const amo = (
    <AmoAnalyticsView
      isAdmin={isAdmin}
      email={user?.email?.toLowerCase() || ""}
    />
  );
  const v = params.get("v");
  // Everyone may put their own picture behind the page (SalesFon.tsx).
  const { fon, setFon } = useSalesFon();
  const fonButton = <FonButton fon={fon} setFon={setFon} />;
  // «Lidlar (ERP)» — the ERP's own CRM (crm/*) — only the owner sees it
  // for now (the owner, 2026-11-12: «managerlarga ko'rinmay tursin»).
  if (!isAdmin)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{fonButton}</div>
        {amo}
      </div>
    );
  const view =
    v === "amo" || v === "voronka" || v === "yutqazilgan" || v === "lidlar"
      ? v
      : "control";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-ink-200 bg-surface p-1">
          {(
            [
              ["control", "Nazorat"],
              ["lidlar", "Lidlar (ERP)"],
              ["voronka", "Voronka"],
              ["yutqazilgan", "Yutqazilganlar"],
              ["amo", "amoCRM tahlil"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() =>
                setParams(k === "control" ? {} : { v: k }, { replace: true })
              }
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === k ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {fonButton}
      </div>
      {view === "control" ? (
        <SalesControl />
      ) : view === "lidlar" ? (
        <LeadsBoard />
      ) : view === "voronka" ? (
        <SalesFunnel />
      ) : view === "yutqazilgan" ? (
        <LostDeals />
      ) : (
        amo
      )}
    </div>
  );
}
