import { Menu, Search, Bell, Plus, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

const titleMap: Record<string, string> = {
  "/dashboard": "Bosh sahifa",
  "/orders": "Buyurtmalar",
  "/customers": "Mijozlar",
  "/products": "Mahsulotlar",
  "/proposals": "Tijorat taklifi",
  "/production": "Ishlab chiqarish",
  "/textile": "Textil",
  "/warehouse": "Ombor",
  "/finance": "Moliya",
  "/reports": "Hisobot",
  "/attendance": "Davomat va KPI",
  "/settings": "Sozlamalar",
};

type Props = { onOpenMobile: () => void };

export default function Topbar({ onOpenMobile }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const base = "/" + location.pathname.split("/")[1];
  const title = titleMap[base] || "Poligrafiya ERP";

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-100 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <div className="font-display text-lg font-bold text-ink-900">{title}</div>
        <div className="text-xs text-ink-500">
          {new Date().toLocaleDateString("uz-UZ", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>
      <div className="hidden items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm md:flex">
        <Search className="h-4 w-4 text-ink-400" />
        <input
          className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
          placeholder="Qidirish..."
        />
      </div>
      <button className="relative rounded-xl p-2 text-ink-500 hover:bg-ink-100">
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
      </button>
      <button
        onClick={() => navigate("/orders/new")}
        className="btn-primary hidden sm:inline-flex"
      >
        <Plus className="h-4 w-4" /> Yangi buyurtma
      </button>
      <div className="hidden items-center gap-2 border-l border-ink-200 pl-3 md:flex">
        <span className="max-w-[10rem] truncate text-xs text-ink-600" title={user?.email ?? ""}>
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          title="Chiqish"
          className="rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={handleLogout}
        title="Chiqish"
        className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 md:hidden"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
