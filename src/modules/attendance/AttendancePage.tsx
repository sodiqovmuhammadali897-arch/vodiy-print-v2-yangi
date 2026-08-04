import { useState } from "react";
import { CalendarCheck, Gauge, Users } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import EmployeeAttendanceCard from "./EmployeeAttendanceCard";
import PasskeySetup from "./PasskeySetup";
import KpiPanel from "./KpiPanel";
import AttendanceAdminTable from "./AttendanceAdminTable";

type Tab = "mine" | "kpi" | "team";

export default function AttendancePage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "mine", label: "Mening davomatim", icon: <CalendarCheck className="h-4 w-4" /> },
    { key: "kpi", label: "KPI", icon: <Gauge className="h-4 w-4" /> },
    ...(isAdmin
      ? [{ key: "team" as Tab, label: "Jamoa holati", icon: <Users className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Davomat va KPI</h1>
        <p className="text-sm text-ink-500">
          Face ID / Passkey orqali davomat va shaxsiy ko'rsatkichlar
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

      {tab === "mine" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EmployeeAttendanceCard />
          <PasskeySetup />
        </div>
      )}
      {tab === "kpi" && <KpiPanel />}
      {tab === "team" && isAdmin && <AttendanceAdminTable />}
    </div>
  );
}
