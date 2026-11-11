import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { canGiftbox } from "../../lib/rolePermissions";

// «Gift box va suvenir narxi»: the owner, or staff with the «Gift box va suvenir narxi» permission.
export default function GiftboxRoute() {
  const auth = useAuth();
  if (auth.staffLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-ink-500" />
      </div>
    );
  }
  if (!auth.staff || !canGiftbox(auth, "view")) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
