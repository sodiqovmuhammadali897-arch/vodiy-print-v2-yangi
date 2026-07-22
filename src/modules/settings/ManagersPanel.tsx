import { useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { deleteOne, insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { Manager } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import { formatMoney, initialsOf } from "../../lib/format";

export default function ManagersPanel() {
  const [rows, setRows] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", monthly_plan: "" });

  const load = async () => {
    setLoading(true);
    const data = await listAll<Manager>("managers", { orderBy: ["created_at", "asc"] });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    await insertOne("managers", {
      name: form.name.trim(),
      monthly_plan: Number(form.monthly_plan) || 0,
      avatar_url: "",
    });
    setForm({ name: "", monthly_plan: "" });
    void load();
  };

  const updatePlan = async (id: string, plan: number) => {
    await updateOne("managers", id, { monthly_plan: plan });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Managerni o'chirmoqchimisiz?")) return;
    await deleteOne("managers", id);
    void load();
  };

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-ink-900">Managerlar</h2>
        <p className="text-xs text-ink-500">
          Sotuv jamoasi va ularning oylik rejasi
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="input"
          placeholder="Manager ismi (masalan: Mahbuba)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          type="number"
          className="input"
          placeholder="Oylik reja (so'm)"
          value={form.monthly_plan}
          onChange={(e) =>
            setForm((f) => ({ ...f, monthly_plan: e.target.value }))
          }
        />
        <button className="btn-primary" onClick={add}>
          <Plus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Managerlar mavjud emas"
        emptyIcon={<Users className="h-5 w-5" />}
      >
        <div className="space-y-2">
          {rows.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-ink-100 p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white">
                {initialsOf(m.name)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink-900">{m.name}</div>
                <div className="text-xs text-ink-500">
                  Reja: {formatMoney(m.monthly_plan)}
                </div>
              </div>
              <input
                type="number"
                className="input w-40"
                defaultValue={m.monthly_plan}
                onBlur={(e) =>
                  updatePlan(m.id, Number(e.target.value) || 0)
                }
              />
              <button
                className="btn-ghost text-rose-600 hover:bg-rose-50"
                onClick={() => remove(m.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
