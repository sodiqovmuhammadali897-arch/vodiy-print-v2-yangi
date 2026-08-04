import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { insertOne, updateOne, deleteOne } from "../../lib/firestoreDb";
import { EXPENSE_CATEGORIES } from "../../lib/orderConstants";
import type { Expense } from "../../lib/types";
import { formatDate, formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";
import AsyncState from "../../components/ui/AsyncState";
import SimpleDonutChart, { type DonutSlice } from "../../components/ui/SimpleDonutChart";

const CATEGORY_COLORS = [
  "#4f46e5",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#0ea5e9",
  "#8b5cf6",
  "#64748b",
  "#ec4899",
];

type Props = {
  expenses: Expense[];
  loading: boolean;
  onChanged: () => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPanel({ expenses, loading, onChanged }: Props) {
  const { can } = useAuth();
  const canEdit = can("finance", "edit");
  const canDelete = can("finance", "delete");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Ushbu xarajatni o'chirishni tasdiqlaysizmi?")) return;
    await deleteOne("expenses", id);
    onChanged();
  };

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + Number(e.amount || 0));
  }
  const donutData: DonutSlice[] = Array.from(byCategory.entries()).map(
    ([label, value], i) => ({
      label,
      value,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }),
  );
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">
            Xarajatlar (chiqim)
          </h2>
          <p className="text-xs text-ink-500">
            Tanlangan davr uchun jami: {formatMoney(total)}
          </p>
        </div>
        {canEdit && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Xarajat qo'shish
          </button>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="mb-4">
          <SimpleDonutChart data={donutData} size={140} />
        </div>
      )}

      <AsyncState
        loading={loading}
        empty={expenses.length === 0}
        emptyLabel="Xarajatlar qo'shilmagan"
        emptyIcon={<Receipt className="h-5 w-5" />}
      >
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60">
              <tr>
                <th className="table-th">Sana</th>
                <th className="table-th">Turi</th>
                <th className="table-th">Izoh</th>
                <th className="table-th text-right">Summa</th>
                {(canEdit || canDelete) && (
                  <th className="table-th text-right">Amallar</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-ink-50/50">
                  <td className="table-td whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="table-td">{e.category}</td>
                  <td className="table-td text-ink-600">{e.note || "-"}</td>
                  <td className="table-td whitespace-nowrap text-right font-semibold">
                    {formatMoney(e.amount)}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            className="btn-ghost"
                            onClick={() => {
                              setEditing(e);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn-ghost text-rose-600 hover:bg-rose-50"
                            onClick={() => remove(e.id)}
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

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        expense={editing}
        onSaved={() => {
          setModalOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

type FormProps = {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  onSaved: () => void;
};

function ExpenseFormModal({ open, onClose, expense, onSaved }: FormProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setCategory(expense.category);
      setAmount(expense.amount);
      setDate(expense.date);
      setNote(expense.note);
    } else {
      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount(0);
      setDate(todayISO());
      setNote("");
    }
    setError(null);
  }, [expense, open]);

  const submit = async () => {
    if (!amount || amount <= 0) return setError("Summa 0 dan katta bo'lishi kerak");
    setSaving(true);
    setError(null);
    try {
      const payload = { category, amount, date, note, created_by: user?.email || "" };
      if (expense) {
        await updateOne("expenses", expense.id, payload);
      } else {
        await insertOne("expenses", payload);
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? "Xarajatni tahrirlash" : "Yangi xarajat"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="label">Turi</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Summa *</label>
          <input
            type="number"
            className="input"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Sana</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[70px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
