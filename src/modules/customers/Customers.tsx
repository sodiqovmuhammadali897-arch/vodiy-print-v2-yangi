import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, UsersRound, Phone, Building2, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Customer } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import CustomerFormModal from "./CustomerFormModal";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [
        c.first_name,
        c.last_name,
        c.phone,
        c.company,
        c.telegram,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [customers, search]);

  const onSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Mijozlar
          </h1>
          <p className="text-sm text-ink-500">
            Mijozlar bazasi va aloqalar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mijozni qidirish..."
              className="w-56 bg-transparent text-sm outline-none placeholder-ink-400"
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Yangi mijoz
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={filtered.length === 0}
          emptyLabel="Mijozlar mavjud emas"
          emptyDescription="Yuqoridagi tugma orqali birinchi mijozingizni qo'shing"
          emptyIcon={<UsersRound className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">F.I.Sh.</th>
                  <th className="table-th">Kompaniya</th>
                  <th className="table-th">Telefon</th>
                  <th className="table-th">Telegram</th>
                  <th className="table-th text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/50">
                    <td className="table-td">
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-semibold text-ink-900 hover:text-brand-700"
                      >
                        {c.first_name} {c.last_name}
                      </Link>
                      {c.position && (
                        <div className="text-xs text-ink-500">{c.position}</div>
                      )}
                    </td>
                    <td className="table-td">
                      {c.company ? (
                        <div className="flex items-center gap-2 text-ink-700">
                          <Building2 className="h-4 w-4 text-ink-400" />
                          {c.company}
                        </div>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td">
                      {c.phone ? (
                        <div className="flex items-center gap-2 text-ink-700">
                          <Phone className="h-4 w-4 text-ink-400" />
                          {c.phone}
                        </div>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td">
                      {c.telegram ? (
                        <a
                          href={`https://t.me/${c.telegram.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                        >
                          <Send className="h-4 w-4" /> {c.telegram}
                        </a>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td text-right">
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setEditing(c);
                          setModalOpen(true);
                        }}
                      >
                        Tahrirlash
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <CustomerFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        customer={editing}
        onSaved={onSaved}
      />
    </div>
  );
}
