import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import AmoAnalyticsView from "./AmoAnalyticsView";
import SalesControl from "./SalesControl";

// Sotuv bo'limi: leads are worked in amoCRM, the ERP shows the numbers.
// Admins open on «Nazorat» — every manager's day on one page
// (SalesControl) — next to the amoCRM analysis (AmoAnalyticsView,
// meta-webhook/amocrm.js); everyone else sees their own amoCRM numbers.
export default function SalesPipeline() {
  const { isAdmin, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const amo = <AmoAnalyticsView isAdmin={isAdmin} email={user?.email?.toLowerCase() || ""} />;
  if (!isAdmin) return amo;
  const view = params.get("v") === "amo" ? "amo" : "control";
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl border border-ink-200 bg-surface p-1">
        {(
          [
            ["control", "Nazorat"],
            ["amo", "amoCRM tahlil"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setParams(k === "amo" ? { v: "amo" } : {}, { replace: true })}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === k ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "control" ? <SalesControl /> : amo}
    </div>
  );
}
