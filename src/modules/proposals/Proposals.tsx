import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Customer, Proposal } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import { formatDate, formatMoney } from "../../lib/format";

export default function Proposals() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<(Proposal & { customer?: Customer })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from("proposals").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
    ]);
    const map = new Map(((c.data as Customer[]) || []).map((x) => [x.id, x]));
    setRows(
      ((p.data as Proposal[]) || []).map((pr) => ({
        ...pr,
        customer: pr.customer_id ? map.get(pr.customer_id) : undefined,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Ushbu tijorat taklifini o'chirishni tasdiqlaysizmi?")) return;
    await supabase.from("proposals").delete().eq("id", id);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Tijorat takliflari
          </h1>
          <p className="text-sm text-ink-500">
            Mijozlar uchun tijorat takliflarini yarating va PDF eksport qiling
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate("/proposals/new")}>
          <Plus className="h-4 w-4" /> Yangi taklif
        </button>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={rows.length === 0}
          emptyLabel="Hozircha takliflar yo'q"
          emptyDescription="Birinchi tijorat taklifingizni yarating"
          emptyIcon={<FileText className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Raqam</th>
                  <th className="table-th">Sarlavha</th>
                  <th className="table-th">Mijoz</th>
                  <th className="table-th">Yaratildi</th>
                  <th className="table-th">Summa</th>
                  <th className="table-th text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50/50">
                    <td className="table-td font-semibold">{p.number}</td>
                    <td className="table-td">
                      <Link
                        to={`/proposals/${p.id}`}
                        className="font-medium text-ink-800 hover:text-brand-700"
                      >
                        {p.title || "-"}
                      </Link>
                    </td>
                    <td className="table-td">
                      {p.customer ? (
                        `${p.customer.first_name} ${p.customer.last_name}`
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="table-td">{formatDate(p.created_at)}</td>
                    <td className="table-td font-semibold">
                      {formatMoney(p.total)}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <Link className="btn-ghost" to={`/proposals/${p.id}`}>
                          <ExternalLink className="h-4 w-4" /> Ochish
                        </Link>
                        <button
                          className="btn-ghost text-rose-600 hover:bg-rose-50"
                          onClick={() => remove(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>
    </div>
  );
}
