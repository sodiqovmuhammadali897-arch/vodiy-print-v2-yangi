import { useEffect, useState } from "react";
import { Save, Target } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { MonthlyPlan } from "../../lib/types";
import { formatMoney, monthNameUz } from "../../lib/format";

export default function MonthlyPlanPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [plan, setPlan] = useState("");
  const [current, setCurrent] = useState<MonthlyPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from("monthly_plans")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle()
      .then(({ data }) => {
        const row = (data as MonthlyPlan) || null;
        setCurrent(row);
        setPlan(row ? String(row.plan_amount) : "");
      });
  }, [year, month]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const amount = Number(plan) || 0;
    const { error } = current
      ? await supabase
          .from("monthly_plans")
          .update({ plan_amount: amount })
          .eq("id", current.id)
      : await supabase
          .from("monthly_plans")
          .insert({ year, month, plan_amount: amount });
    setSaving(false);
    setMsg(error ? error.message : "Saqlandi");
    setTimeout(() => setMsg(null), 2500);
    if (!error) {
      const { data } = await supabase
        .from("monthly_plans")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      setCurrent((data as MonthlyPlan) || null);
    }
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
