import { useEffect, useState } from "react";
import { Save, Target } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import type { MonthlyPlan } from "../../lib/types";
import { formatMoney, monthNameUz } from "../../lib/format";

const planId = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export default function MonthlyPlanPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const row = await getOne<MonthlyPlan>("monthly_plans", planId(year, month));
      setPlan(row ? String(row.plan_amount) : "");
    })();
  }, [year, month]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const amount = Number(plan) || 0;
    try {
      await upsertOne("monthly_plans", planId(year, month), {
        year,
        month,
        plan_amount: amount,
      });
      setMsg("Saqlandi");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Xatolik");
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Oylik reja
          </h2>
          <p className="text-xs text-ink-500">
            Bosh sahifadagi "Bu oy rejasi" statistikasi shu qiymatdan olinadi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <span className="text-xs font-semibold text-emerald-700">{msg}</span>
          )}
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="label">Yil</label>
          <select
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Oy</label>
          <select
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthNameUz(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Reja (so'm)</label>
          <input
            type="number"
            className="input"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl bg-brand-50 p-4 text-brand-800">
        <Target className="h-5 w-5" />
        <div className="text-sm">
          {monthNameUz(month)} {year} rejasi:{" "}
          <span className="font-bold">{formatMoney(Number(plan) || 0)}</span>
        </div>
      </div>
    </div>
  );
}
