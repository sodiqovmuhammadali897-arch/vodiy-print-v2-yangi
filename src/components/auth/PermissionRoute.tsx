import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader, ShieldAlert } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { canSeeOwnKpi, type ModuleKey } from "../../lib/permissions";
import { visibleNav } from "../layout/Sidebar";

// kpi: also let in an account that may see its own KPI (Davomat va KPI).
type Props = { module: ModuleKey; kpi?: boolean };

export default function PermissionRoute({ module, kpi }: Props) {
  const auth = useAuth();
  const { staff, staffLoading, isAdmin, can } = auth;
  const { pathname } = useLocation();

  if (staffLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-ink-500" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldAlert className="h-8 w-8 text-amber-500" />
        <p className="max-w-sm text-sm text-ink-600">
          Sizga hali tizimga kirish ruxsati berilmagan. Administrator bilan
          bog'laning.
        </p>
      </div>
    );
  }

  if (!isAdmin && !can(module, "view") && !(kpi && canSeeOwnKpi(staff))) {
    // Send them to the first page they can open — never back to this one
    // (an account without Bosh sahifa used to bounce to /dashboard forever).
    const to = visibleNav(auth).find((i) => !pathname.startsWith(i.to))?.to || "/tasks";
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
