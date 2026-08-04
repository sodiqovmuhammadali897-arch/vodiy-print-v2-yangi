import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Boxes, Pencil, Trash2, Lock } from "lucide-react";
import { deleteOne, getOne, listAll } from "../../lib/firestoreDb";
import type { Product, ProductCost } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import AsyncState from "../../components/ui/AsyncState";
import ProductFormModal from "./ProductFormModal";
import PriceCalculator from "./PriceCalculator";

export default function Products() {
  const { can, isAdmin } = useAuth();
  const canEdit = can("products", "edit");
  const canDelete = can("products", "delete");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listAll<Product>("products", { orderBy: ["name", "asc"] });
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.category].join(" ").toLowerCase().includes(q),
    );
  }, [products, search]);

  const remove = async (id: string) => {
    if (!confirm("Ushbu mahsulotni o'chirishni tasdiqlaysizmi?")) return;
    await deleteOne("products", id);
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Mahsulotlar</h1>
          <p className="text-sm text-ink-500">
            Umumiy mahsulotlar katalogi va narx pog'onasi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot qidirish..."
              className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi mahsulot
            </button>
          )}
        </div>
      </div>

      <PriceCalculator products={products} />

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Mahsulotlar qo'shilmagan"
          emptyDescription="Yuqoridagi tugma orqali birinchi mahsulotingizni qo'shing"
          emptyIcon={<Boxes className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Mahsulot</th>
                  <th className="table-th">Kategoriya</th>
                  <th className="table-th">Narx pog'onasi</th>
                  {isAdmin && (
                    <th className="table-th">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Tan narx
                      </span>
                    </th>
                  )}
                  {(canEdit || canDelete) && (
                    <th className="table-th text-right">Amallar</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50/50">
                    <td className="table-td font-medium text-ink-800">{p.name}</td>
                    <td className="table-td text-ink-600">{p.category || "-"}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {(p.price_tiers || []).map((t, i) => (
                          <span
                            key={i}
                            className="chip bg-ink-100 text-ink-700"
                          >
                            {t.min_qty}+ · {formatMoney(t.price)}
                          </span>
                        ))}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="table-td">
                        <ProductCostCell productId={p.id} />
                      </td>
                    )}
                    {(canEdit || canDelete) && (
                      <td className="table-td">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              className="btn-ghost"
                              onClick={() => {
                                setEditing(p);
                                setModalOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="btn-ghost text-rose-600 hover:bg-rose-50"
                              onClick={() => remove(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editing}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ProductCostCell({ productId }: { productId: string }) {
  const [cost, setCost] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOne<ProductCost>("product_costs", productId).then((c) => {
      if (!cancelled) setCost(c?.cost_price ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return <span className="text-ink-600">{cost === null ? "..." : formatMoney(cost)}</span>;
}
