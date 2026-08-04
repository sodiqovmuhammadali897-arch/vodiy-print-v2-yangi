import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

export default function AdminRoute() {
  const { staff, staffLoading, isAdmin } = useAuth();

  if (staffLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-ink-500" />
      </div>
    );
  }

  if (!staff || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
