import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <Loader className="h-6 w-6 animate-spin text-ink-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
