import { useEffect, useState } from "react";
import { Building2, Users, Target, CalendarDays } from "lucide-react";
import CompanySettingsPanel from "./CompanySettingsPanel";
import ManagersPanel from "./ManagersPanel";
import MonthlyPlanPanel from "./MonthlyPlanPanel";
import HolidaysPanel from "./HolidaysPanel";

type Tab = "company" | "managers" | "plan" | "holidays";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "company", label: "Kompaniya ma'lumotlari", icon: <Building2 className="h-4 w-4" /> },
  { key: "managers", label: "Managerlar", icon: <Users className="h-4 w-4" /> },
  { key: "plan", label: "Oylik reja", icon: <Target className="h-4 w-4" /> },
  { key: "holidays", label: "Bayram kunlari", icon: <CalendarDays className="h-4 w-4" /> },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("company");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (tabs.some((t) => t.key === hash)) setTab(hash as Tab);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Sozlamalar</h1>
        <p className="text-sm text-ink-500">
          Kompaniya rekvizitlari, jamoa va rejalarni boshqaring
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ink-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "company" && <CompanySettingsPanel />}
      {tab === "managers" && <ManagersPanel />}
      {tab === "plan" && <MonthlyPlanPanel />}
      {tab === "holidays" && <HolidaysPanel />}
    </div>
  );
}
