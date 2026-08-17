import { useMemo, useState } from "react";
import { Boxes, ImageOff, Plus, Search } from "lucide-react";
import type { Product } from "../../lib/types";
import { PRODUCT_CATEGORIES } from "../../lib/orderConstants";
import AsyncState from "../../components/ui/AsyncState";

type StatusTab = "all" | "active" | "inactive" | "archived";

type Props = {
  products: Product[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (p: Product) => void;
  canEdit: boolean;
  onNew: () => void;
};

const isArchived = (p: Product) => !!p.archived_at;
const isActive = (p: Product) => p.is_active !== false && !isArchived(p);

export default function ProductList({ products, loading, selectedId, onSelect, canEdit, onNew }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");

  const counts = useMemo(
    () => ({
      all: products.length,
      active: products.filter(isActive).length,
      inactive: products.filter((p) => !isActive(p) && !isArchived(p)).length,
      archived: products.filter(isArchived).length,
    }),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusTab === "active" && !isActive(p)) return false;
      if (statusTab === "inactive" && (isActive(p) || isArchived(p))) return false;
      if (statusTab === "archived" && !isArchived(p)) return false;
      if (category !== "all" && p.category !== category) return false;
      if (q && ![p.name, p.category, p.product_code].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, category, statusTab]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-sm">
      <div className="space-y-3 border-b border-ink-100 p-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/60 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish..."
              className="w-full bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          {canEdit && (
            <button className="btn-primary shrink-0 !px-2.5" onClick={onNew} title="Yangi mahsulot">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          className="input !py-1.5 text-xs"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Barcha turlar</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["all", "Barchasi"],
              ["active", "Faol"],
              ["inactive", "Nofaol"],
              ["archived", "Arxiv"],
            ] as [StatusTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusTab(key)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                statusTab === key
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-600 hover:bg-ink-200"
              }`}
            >
              {label} <span className="opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Mahsulot topilmadi"
          emptyIcon={<Boxes className="h-5 w-5" />}
        >
          <div className="space-y-1">
            {filtered.map((p) => {
              const selected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-brand-300 bg-brand-50 shadow-sm"
                      : "border-transparent hover:bg-ink-50"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100 text-ink-400">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-900">{p.name}</div>
                    <div className="truncate text-xs text-ink-500">{p.category || "-"}</div>
                  </div>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isArchived(p)
                        ? "bg-ink-300"
                        : isActive(p)
                          ? "bg-emerald-500"
                          : "bg-amber-400"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </AsyncState>
      </div>
    </div>
  );
}
