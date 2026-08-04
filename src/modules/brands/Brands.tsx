import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Tag } from "lucide-react";
import { listAll } from "../../lib/firestoreDb";
import type { Brand, Customer } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import BrandFormModal from "./BrandFormModal";
import { useAuth } from "../../lib/AuthContext";

type Row = Brand & { customer?: Customer };

export default function Brands() {
  const { can } = useAuth();
  const canEdit = can("brands", "edit");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const load = async () => {
    setLoading(true);
    const [brands, customers] = await Promise.all([
      listAll<Brand>("brands", { orderBy: ["created_at", "desc"] }),
      listAll<Customer>("customers"),
    ]);
    const map = new Map(customers.map((x) => [x.id, x]));
    setRows(brands.map((br) => ({ ...br, customer: map.get(br.customer_id) })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((b) =>
      [b.name, b.customer?.first_name, b.customer?.last_name, b.customer?.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Brendlar</h1>
          <p className="text-sm text-ink-500">
            Bir mijoz bir nechta brendga ega bo'lishi mumkin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Brendni qidirish..."
              className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          {canEdit && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModal(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi brend
            </button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Brendlar mavjud emas"
          emptyDescription="Yangi brend yaratish uchun mijoz kerak"
          emptyIcon={<Tag className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="group rounded-xl border border-ink-100 p-4 transition hover:border-brand-300 hover:shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900 truncate">
                      {b.name}
                    </div>
                    {b.customer && (
                      <Link
                        to={`/customers/${b.customer.id}`}
                        className="text-xs text-brand-700 hover:underline"
                      >
                        {b.customer.first_name} {b.customer.last_name}
                        {b.customer.company ? ` · ${b.customer.company}` : ""}
                      </Link>
                    )}
                    {b.note && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                        {b.note}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="mt-3 flex justify-end">
                    <button
                      className="btn-ghost opacity-0 transition group-hover:opacity-100"
                      onClick={() => {
                        setEditing(b);
                        setModal(true);
                      }}
                    >
                      Tahrirlash
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </AsyncState>
      </div>

      <BrandFormModal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditing(null);
        }}
        brand={editing}
        onSaved={() => {
          setModal(false);
          setEditing(null);
          void load();
        }}
      />
    </div>
  );
}
