import LeadKpiRow from "./LeadKpiRow";
import LeadSourceDonut from "./LeadSourceDonut";
import ManagerLeadsPanel from "./ManagerLeadsPanel";
import LeadFunnelPanel from "./LeadFunnelPanel";
import RecentLostLeadsPanel from "./RecentLostLeadsPanel";
import TodayUsagePanel from "./TodayUsagePanel";

type Props = { managerEmail: string };

// managerEmail is "all" (admin, no filter picked) or a specific staff
// email — mirrors the Kanban board's own manager filter, one level up,
// so switching that dropdown re-scopes every widget here to match.
export default function SalesActivitySection({ managerEmail }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-ink-900">Sotuv faolligi</h2>

      <LeadKpiRow managerEmail={managerEmail} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <LeadSourceDonut managerEmail={managerEmail} />
        {managerEmail === "all" && <ManagerLeadsPanel />}
        <LeadFunnelPanel managerEmail={managerEmail} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentLostLeadsPanel managerEmail={managerEmail} />
        <TodayUsagePanel managerEmail={managerEmail} />
      </div>
    </div>
  );
}
