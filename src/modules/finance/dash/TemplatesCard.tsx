import { useState } from "react";
import { CalendarCheck2, CheckCircle2, Clock, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { deleteOne, insertOne } from "../../../lib/firestoreDb";
import { useAuth } from "../../../lib/AuthContext";
import { EXPENSE_CATEGORIES, VENDOR_EXPENSE_CATEGORY } from "../../../lib/orderConstants";
import { formatMoney, formatMoneyShort } from "../../../lib/format";
import type { TemplateState } from "../../../lib/financeDash";

// Doimiy xarajatlar: ijara, maosh, internet … are set up once
// (expense_templates); each month the card shows which were entered, and
// «Kiritish» adds that month's expense in one click (marked template_id).
// Nothing is written on its own — a person presses the button.
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))}-${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c !== VENDOR_EXPENSE_CATEGORY);

export default function TemplatesCard({ states, month, today, canEdit, onChanged }: { states: TemplateState[]; month: string; today: string; canEdit: boolean; onChanged: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Ijara", amount: "", due_day: "5" });
  const [error, setError] = useState("");
  const done = states.filter((s) => s.entered).length;
  const left = states.filter((s) => !s.entered).reduce((sum, s) => sum + Number(s.template.amount || 0), 0);

  const enter = async (s: TemplateState) => {
    setBusy(s.template.id);
    setError("");
    try {
      await insertOne("expenses", {
        category: s.template.category,
        amount: Number(s.template.amount),
        date: s.dueDate <= today ? s.dueDate : today,
        note: s.template.name,
        vendor_id: null,
        vendor_name: "",
        template_id: s.template.id,
        created_by: user?.email || "",
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const amount = Number(String(form.amount).replace(/\s/g, ""));
    const dueDay = Math.min(28, Math.max(1, Number(form.due_day) || 1));
    if (!form.name.trim()) return setError("Nomini yozing");
    if (!amount || amount <= 0) return setError("Summani yozing");
    setBusy("new");
    setError("");
    try {
      await insertOne("expense_templates", { name: form.name.trim(), category: form.category, amount, due_day: dueDay, active: true, created_by: user?.email || "" });
      setForm({ name: "", category: "Ijara", amount: "", due_day: "5" });
      setAdding(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Bu doimiy xarajat shablonini o'chirasizmi? Kiritilgan xarajatlar qoladi.")) return;
    setBusy(id);
    try {
      await deleteOne("expense_templates", id);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="doimiy-xarajatlar" className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <Repeat className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Doimiy xarajatlar</h2>
            <p className="text-xs text-ink-500">
              {states.length ? `${MONTHS[Number(month.slice(5, 7)) - 1]}: ${done} / ${states.length} kiritildi${left ? ` · qoldi ${formatMoneyShort(left)}` : ""}` : "Ijara, maosh, internet — bir marta sozlang"}
            </p>
          </div>
        </div>
        {canEdit && !adding && (
          <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Shablon
          </button>
        )}
      </div>

      {states.length > 0 && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-[#1baf7a] transition-all dark:bg-[#199e70]" style={{ width: `${(done / states.length) * 100}%` }} />
        </div>
      )}

      <div className="divide-y divide-ink-100">
        {states.map((s) => (
          <div key={s.template.id} className="flex items-center gap-3 py-2.5">
            {s.entered ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Clock className={`h-5 w-5 shrink-0 ${s.dueDate < today ? "text-rose-500" : "text-ink-400"}`} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink-900">{s.template.name}</div>
              <div className="truncate text-xs text-ink-500">
                <span className="hidden sm:inline">{s.template.category} · </span>
                {s.entered ? `kiritildi ${dayLabel(String(s.entered.date).slice(0, 10))}` : `${s.dueDate < today ? "muddati o'tdi" : "muddati"} ${dayLabel(s.dueDate)}`}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="text-right text-sm font-semibold tabular-nums text-ink-900">{formatMoneyShort(s.template.amount)}</div>
              {canEdit && !s.entered && (
                <button type="button" disabled={busy === s.template.id} onClick={() => void enter(s)} className="btn-primary px-2.5 py-1.5 text-xs" title={`${formatMoney(s.template.amount)} — Xarajatlarga yozish`}>
                  {busy === s.template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck2 className="h-3.5 w-3.5" />} Kiritish
                </button>
              )}
            </div>
            {canEdit && (
              <button type="button" onClick={() => void remove(s.template.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-rose-600" aria-label="Shablonni o'chirish">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {!states.length && !adding && <p className="py-4 text-sm text-ink-500">Hali shablon yo'q. «Shablon» bilan ijara, maosh, kommunal va reklamani qo'shing — har oy bir bosishda kiritasiz va sof foyda to'g'ri chiqadi.</p>}
      </div>

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl border border-ink-200 p-3">
          <input className="input" placeholder="Nomi: masalan, Ofis ijarasi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="input" inputMode="numeric" placeholder="Summa, so'm" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-600">
            Har oyning
            <input className="input w-16 py-1" inputMode="numeric" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
            -sanasida to'lanadi
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setAdding(false)}>
              Bekor
            </button>
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy === "new"} onClick={() => void save()}>
              {busy === "new" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Saqlash
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </section>
  );
}
