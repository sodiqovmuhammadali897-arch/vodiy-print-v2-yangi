import { useEffect, useState } from "react";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { deleteOne, insertOne, listAll } from "../../lib/firestoreDb";
import type { Holiday } from "../../lib/types";
import AsyncState from "../../components/ui/AsyncState";
import { formatDate } from "../../lib/format";

export default function HolidaysPanel() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", name: "" });

  const load = async () => {
    setLoading(true);
    const data = await listAll<Holiday>("holidays", { orderBy: ["date", "asc"] });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!form.date) return;
    await insertOne("holidays", {
      date: form.date,
      name: form.name.trim(),
    });
    setForm({ date: "", name: "" });
    void load();
  };

  const remove = async (id: string) => {
    await deleteOne("holidays", id);
    void load();
  };

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Bayram va dam olish kunlari
        </h2>
        <p className="text-xs text-ink-500">
          Yakshanba avtomatik dam olish deb hisoblanadi. Bu yerga faqat qo'shimcha
          bayram kunlarini qo'shing.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-[auto_1fr_auto]">
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        />
        <input
          className="input"
          placeholder="Bayram nomi (masalan: Mustaqillik kuni)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <button className="btn-primary" onClick={add}>
          <Plus className="h-4 w-4" /> Qo'shish
        </button>
      </div>

      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Bayram kunlari qo'shilmagan"
        emptyIcon={<CalendarDays className="h-5 w-5" />}
      >
        <div className="divide-y divide-ink-100">
          {rows.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between py-2.5"
            >
              <div>
                <div className="font-semibold text-ink-900">
                  {h.name || "Bayram"}
                </div>
                <div className="text-xs text-ink-500">{formatDate(h.date)}</div>
              </div>
              <button
                className="btn-ghost text-rose-600 hover:bg-rose-50"
                onClick={() => remove(h.id)}
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
