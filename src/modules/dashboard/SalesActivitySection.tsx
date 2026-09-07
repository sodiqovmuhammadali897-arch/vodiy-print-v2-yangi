import { useAuth } from "../../lib/AuthContext";
import LeadKpiRow from "./LeadKpiRow";
import LeadSourceDonut from "./LeadSourceDonut";
import ManagerLeadsPanel from "./ManagerLeadsPanel";
import LeadFunnelPanel from "./LeadFunnelPanel";
import RecentLostLeadsPanel from "./RecentLostLeadsPanel";
import TodayUsagePanel from "./TodayUsagePanel";

export default function SalesActivitySection() {
  const { isAdmin, can } = useAuth();
  const hasLeadsStake = isAdmin || can("leads", "view") || can("leads", "edit");
  const hasTasksStake = isAdmin || can("tasks", "view") || can("tasks", "edit");

  if (!hasLeadsStake && !hasTasksStake) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-ink-900">Sotuv faolligi</h2>

      <LeadKpiRow />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <LeadSourceDonut />
        <ManagerLeadsPanel />
        <LeadFunnelPanel />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentLostLeadsPanel />
        <TodayUsagePanel />
      </div>
    </div>
  );
}
