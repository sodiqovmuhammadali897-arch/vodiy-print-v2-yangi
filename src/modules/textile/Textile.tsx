import { useEffect, useMemo, useState } from "react";
import { Search, Shirt } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Product } from "../../lib/types";
import { formatMoney } from "../../lib/format";
import AsyncState from "../../components/ui/AsyncState";

export default function Textile() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void listAll<Product>("products", { orderBy: ["name", "asc"] }).then((rows) => {
      setProducts(rows.filter((p) => p.category === "Textil"));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink-900">
            <Shirt className="h-6 w-6 text-brand-600" /> Textil
          </h1>
          <p className="text-sm text-ink-500">
            Mahsulotlar katalogidagi Textil kategoriyali mahsulotlar
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot qidirish..."
            className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
          />
        </div>
      </div>

      <AsyncState
        loading={loading}
        empty={filtered.length === 0}
        emptyLabel="Textil mahsulotlar mavjud emas"
        emptyDescription={`Mahsulotlar bo'limida kategoriyani "Textil" qilib mahsulot qo'shsangiz, u shu yerda avtomatik ko'rinadi`}
        emptyIcon={<Shirt className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="card space-y-3 p-4">
              <div className="font-display text-base font-bold text-ink-900">{p.name}</div>

              {p.sizes.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-ink-500">Razmerlar</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.sizes.map((s) => (
                      <span key={s} className="chip bg-ink-100 text-ink-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {p.colors.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-ink-500">Ranglar</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.colors.map((c) => (
                      <span key={c} className="chip bg-ink-100 text-ink-700">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold uppercase text-ink-500">
                  Narx pog'onasi
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.price_tiers.map((t, i) => (
                    <span key={i} className="chip bg-emerald-50 text-emerald-800">
                      {t.min_qty}+ · {formatMoney(t.price)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
