import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, Users, Target, CalendarDays, Shirt, ShieldCheck, Clock, Send, Instagram, FileSpreadsheet, Swords, Bell, Smartphone } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import NotificationsPage from "../notifications/NotificationsPage";
import AppPanel from "./AppPanel";
import CompanySettingsPanel from "./CompanySettingsPanel";
import ManagersPanel from "./ManagersPanel";
import MonthlyPlanPanel from "./MonthlyPlanPanel";
import HolidaysPanel from "./HolidaysPanel";
import TextileCompaniesPanel from "./TextileCompaniesPanel";
import StaffPermissionsPanel from "./StaffPermissionsPanel";
import WorkSchedulePanel from "./WorkSchedulePanel";
import SeedPanel from "./SeedPanel";
import TelegramGroupPanel from "./TelegramGroupPanel";
import InstagramPanel from "./InstagramPanel";
import ImportPanel from "./ImportPanel";
import CompetitorsPanel from "./CompetitorsPanel";

type Tab =
  | "notifications"
  | "app"
  | "company"
  | "managers"
  | "plan"
  | "holidays"
  | "textile"
  | "staff"
  | "workSchedule"
  | "telegram"
  | "instagram"
  | "import"
  | "competitors";

// The first two are everyone's own; the rest only admins see.
const tabs: { key: Tab; label: string; icon: React.ReactNode; everyone?: boolean }[] = [
  { key: "notifications", label: "Bildirishnomalar", icon: <Bell className="h-4 w-4" />, everyone: true },
  { key: "app", label: "Ilova va yangilanish", icon: <Smartphone className="h-4 w-4" />, everyone: true },
  { key: "company", label: "Kompaniya ma'lumotlari", icon: <Building2 className="h-4 w-4" /> },
  { key: "managers", label: "Managerlar", icon: <Users className="h-4 w-4" /> },
  { key: "plan", label: "Oylik reja", icon: <Target className="h-4 w-4" /> },
  { key: "holidays", label: "Bayram kunlari", icon: <CalendarDays className="h-4 w-4" /> },
  { key: "textile", label: "Textil kompaniyalari", icon: <Shirt className="h-4 w-4" /> },
  { key: "staff", label: "Xodimlar va ruxsatlar", icon: <ShieldCheck className="h-4 w-4" /> },
  { key: "workSchedule", label: "Ish jadvali", icon: <Clock className="h-4 w-4" /> },
  { key: "telegram", label: "Telegram guruh", icon: <Send className="h-4 w-4" /> },
  { key: "instagram", label: "Instagram Direct", icon: <Instagram className="h-4 w-4" /> },
  { key: "import", label: "Excel import", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { key: "competitors", label: "Raqobatchilar", icon: <Swords className="h-4 w-4" /> },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const visible = tabs.filter((t) => t.everyone || isAdmin);
  const fromHash = location.hash.replace("#", "");
  const [tab, setTab] = useState<Tab>(visible.some((t) => t.key === fromHash) ? (fromHash as Tab) : isAdmin ? "company" : "notifications");

  // Links like /settings#notifications open that tab.
  useEffect(() => {
    if (visible.some((t) => t.key === fromHash)) setTab(fromHash as Tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromHash]);

  const open = (key: Tab) => {
    setTab(key);
    navigate({ hash: `#${key}` }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Sozlamalar</h1>
        <p className="text-sm text-ink-500">
          {isAdmin ? "Bildirishnomalar, ilova, kompaniya rekvizitlari, jamoa va rejalar" : "Bildirishnomalar va ilova"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-ink-100">
        {visible.map((t) => (
          <button
            key={t.key}
            onClick={() => open(t.key)}
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

      {isAdmin && tab === "company" && <SeedPanel />}

      {tab === "notifications" && <NotificationsPage />}
      {tab === "app" && <AppPanel />}
      {isAdmin && tab === "company" && <CompanySettingsPanel />}
      {isAdmin && tab === "managers" && <ManagersPanel />}
      {isAdmin && tab === "plan" && <MonthlyPlanPanel />}
      {isAdmin && tab === "holidays" && <HolidaysPanel />}
      {isAdmin && tab === "textile" && <TextileCompaniesPanel />}
      {isAdmin && tab === "staff" && <StaffPermissionsPanel />}
      {isAdmin && tab === "workSchedule" && <WorkSchedulePanel />}
      {isAdmin && tab === "telegram" && <TelegramGroupPanel />}
      {isAdmin && tab === "instagram" && <InstagramPanel />}
      {isAdmin && tab === "import" && <ImportPanel />}
      {isAdmin && tab === "competitors" && <CompetitorsPanel />}
    </div>
  );
}
