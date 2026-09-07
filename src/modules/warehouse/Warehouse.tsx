import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Layers,
  Pencil,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import { WAREHOUSE_CATEGORIES } from "../../lib/orderConstants";
import type { WarehouseItem, WarehouseTransaction, WarehouseTransactionType } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import AsyncState from "../../components/ui/AsyncState";
import StatCard from "../../components/ui/StatCard";
import WarehouseItemFormModal from "./WarehouseItemFormModal";
import WarehouseTransactionModal from "./WarehouseTransactionModal";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Warehouse() {
  const { can } = useAuth();
  const canEdit = can("warehouse", "edit");

  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txItem, setTxItem] = useState<WarehouseItem | null>(null);
  const [txType, setTxType] = useState<WarehouseTransactionType>("in");

  const load = async () => {
    setLoading(true);
    const [i, t] = await Promise.all([
      listAll<WarehouseItem>("warehouse_items", { orderBy: ["name", "asc"] }),
      listAll<WarehouseTransaction>("warehouse_transactions", { orderBy: ["created_at", "desc"] }),
    ]);
    setItems(i);
    setTransactions(t);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const isLow = (i: WarehouseItem) => i.quantity <= i.min_threshold;

  const stats = useMemo(() => {
    const today = todayISO();
    const todayTx = transactions.filter((t) => t.date === today);
    return {
      totalTypes: items.length,
      lowCount: items.filter(isLow).length,
      todayIn: todayTx.filter((t) => t.type === "in").reduce((s, t) => s + t.quantity, 0),
      todayOut: todayTx.filter((t) => t.type === "out").reduce((s, t) => s + t.quantity, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (lowOnly && !isLow(i)) return false;
      if (q && !`${i.name} ${i.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, category, lowOnly]);

  const recentTx = transactions.slice(0, 15);

  const openNewItem = () => {
    setEditingItem(null);
    setItemModalOpen(true);
  };
  const openEditItem = (item: WarehouseItem) => {
    setEditingItem(item);
    setItemModalOpen(true);
  };
  const openTx = (item: WarehouseItem, type: WarehouseTransactionType) => {
    setTxItem(item);
    setTxType(type);
    setTxModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Ombor</h1>
          <p className="text-sm text-ink-500">
            Tayyor mahsulot va xomashyo zaxirasi — suvenir, gift box, qog'oz, laminat va h.k.
          </p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={openNewItem}>
            <Plus className="h-4 w-4" /> Yangi mahsulot
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Jami mahsulot turlari" value={stats.totalTypes} icon={<Layers className="h-5 w-5" />} tone="brand" />
        <StatCard
          title="Kam qolganlar"
          value={stats.lowCount}
          icon={<Boxes className="h-5 w-5" />}
          tone={stats.lowCount > 0 ? "amber" : "emerald"}
        />
        <StatCard title="Bugungi kirim" value={stats.todayIn} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Bugungi chiqim" value={stats.todayOut} icon={<TrendingDown className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot qidirish..."
            className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
        <button
          onClick={() => setCategory("all")}
          className={`chip ${category === "all" ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
        >
          Barchasi
        </button>
        {WAREHOUSE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`chip ${category === c ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={`chip ml-auto ${lowOnly ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
        >
          ⚠ Kam qolganlar ({stats.lowCount})
        </button>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Mahsulot topilmadi"
          emptyDescription="Yuqoridagi tugma orqali birinchi mahsulotingizni qo'shing"
          emptyIcon={<Boxes className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Mahsulot</th>
                  <th className="table-th">Zaxira</th>
                  <th className="table-th">Holati</th>
                  {canEdit && <th className="table-th text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((item) => {
                  const low = isLow(item);
                  const barPct = low
                    ? Math.min(100, (item.quantity / Math.max(item.min_threshold, 1)) * 100)
                    : 100;
                  return (
                    <tr key={item.id} className="hover:bg-ink-50/50">
                      <td className="table-td">
                        <div className="font-medium text-ink-800">{item.name}</div>
                        <div className="text-xs text-ink-500">{item.category}</div>
                      </td>
                      <td className="table-td">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-lg font-bold tabular-nums ${low ? "text-amber-600" : "text-ink-900"}`}>
                            {item.quantity.toLocaleString("uz-UZ")}
                          </span>
                          <span className="text-xs text-ink-400">{item.unit}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="table-td">
                        <span className={`chip ${low ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                          {low ? "⚠ Kam qoldi" : "✓ Yetarli"}
                        </span>
                        <div className="mt-1 text-[11px] text-ink-400">
                          Min: {item.min_threshold} {item.unit}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="table-td">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="btn-ghost text-emerald-600 hover:bg-emerald-50"
                              title="Kirim"
                              onClick={() => openTx(item, "in")}
                            >
                              <ArrowDownCircle className="h-4 w-4" />
                            </button>
                            <button
                              className="btn-ghost text-rose-600 hover:bg-rose-50"
                              title="Chiqim"
                              onClick={() => openTx(item, "out")}
                            >
                              <ArrowUpCircle className="h-4 w-4" />
                            </button>
                            <button className="btn-ghost" title="Tahrirlash" onClick={() => openEditItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <div>
        <h2 className="mb-3 font-display text-base font-bold text-ink-900">So'nggi harakatlar</h2>
        <div className="card overflow-hidden">
          <AsyncState
            loading={loading}
            empty={recentTx.length === 0}
            emptyLabel="Hali harakat qilinmagan"
            emptyIcon={<Boxes className="h-5 w-5" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50/60">
                  <tr>
                    <th className="table-th">Sana</th>
                    <th className="table-th">Mahsulot</th>
                    <th className="table-th">Turi</th>
                    <th className="table-th">Miqdor</th>
                    <th className="table-th">Kim</th>
                    <th className="table-th">Sabab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {recentTx.map((t) => (
                    <tr key={t.id} className="hover:bg-ink-50/50">
                      <td className="table-td text-ink-600">{t.date}</td>
                      <td className="table-td font-medium text-ink-800">{t.item_name}</td>
                      <td className="table-td">
                        <span
                          className={`chip ${t.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                        >
                          {t.type === "in" ? "↓ Kirim" : "↑ Chiqim"}
                        </span>
                      </td>
                      <td className={`table-td font-semibold tabular-nums ${t.type === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                        {t.type === "in" ? "+" : "−"}
                        {t.quantity.toLocaleString("uz-UZ")}
                      </td>
                      <td className="table-td text-ink-600">{t.performed_by || "-"}</td>
                      <td className="table-td text-ink-500">{t.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </div>
      </div>

      <WarehouseItemFormModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        item={editingItem}
        onSaved={() => {
          setItemModalOpen(false);
          void load();
        }}
      />

      <WarehouseTransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        item={txItem}
        defaultType={txType}
        onSaved={() => {
          setTxModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}
