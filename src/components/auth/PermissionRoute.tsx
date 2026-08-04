import { Navigate, Outlet } from "react-router-dom";
import { Loader, ShieldAlert } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import type { ModuleKey } from "../../lib/permissions";

type Props = { module: ModuleKey };

export default function PermissionRoute({ module }: Props) {
  const { staff, staffLoading, isAdmin, can } = useAuth();

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

  if (!isAdmin && !can(module, "view")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
