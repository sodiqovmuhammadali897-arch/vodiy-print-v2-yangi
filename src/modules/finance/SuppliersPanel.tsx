import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus2, HandCoins, Trash2, Factory } from "lucide-react";
import { deleteOne, insertOne, listAll } from "../../lib/firestoreDb";
import { VENDOR_EXPENSE_CATEGORY } from "../../lib/orderConstants";
import type { Expense, ProductionCompany, SupplierInvoice } from "../../lib/types";
import { formatDate, formatMoney } from "../../lib/format";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";
import AsyncState from "../../components/ui/AsyncState";

type Props = {
  // All-time expenses, not the date-range slice — a supplier balance is
  // everything they ever billed minus everything we ever paid them.
  expenses: Expense[];
  loading: boolean;
  onChanged: () => void;
};

type Row = {
  vendor: ProductionCompany;
  invoiced: number;
  paid: number;
  balance: number;
  invoices: SupplierInvoice[];
  payments: Expense[];
};

type EntryMode = "invoice" | "payment";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function SuppliersPanel({ expenses, loading, onChanged }: Props) {
  const { can } = useAuth();
  const canEdit = can("finance", "edit");
  const canDelete = can("finance", "delete");
  const [vendors, setVendors] = useState<ProductionCompany[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entry, setEntry] = useState<{ mode: EntryMode; vendorId: string } | null>(null);

  const loadOwn = async () => {
    const [v, inv] = await Promise.all([
      listAll<ProductionCompany>("production_companies", { orderBy: ["name", "asc"] }),
      listAll<SupplierInvoice>("supplier_invoices", { orderBy: ["date", "desc"] }),
    ]);
    setVendors(v.filter((x) => !x.is_internal));
    setInvoices(inv);
  };

  useEffect(() => {
    void loadOwn();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const vendorPayments = expenses.filter((e) => e.category === VENDOR_EXPENSE_CATEGORY && e.vendor_id);
    return vendors
      .map((vendor) => {
        const inv = invoices.filter((i) => i.vendor_id === vendor.id);
        const pay = vendorPayments.filter((e) => e.vendor_id === vendor.id);
        const invoiced = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
        const paid = pay.reduce((s, e) => s + Number(e.amount || 0), 0);
        return { vendor, invoiced, paid, balance: invoiced - paid, invoices: inv, payments: pay };
      })
      .filter((r) => r.invoiced > 0 || r.paid > 0 || canEdit)
      .sort((a, b) => b.balance - a.balance || a.vendor.name.localeCompare(b.vendor.name));
  }, [vendors, invoices, expenses, canEdit]);

  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);

  const removeInvoice = async (id: string) => {
    if (!confirm("Ushbu hisob-fakturani o'chirishni tasdiqlaysizmi?")) return;
    await deleteOne("supplier_invoices", id);
    await loadOwn();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Ta'minotchilar hisobi</h2>
          <p className="text-xs text-ink-500">
            Ta'minotchilarga qarzimiz: <span className="font-semibold text-amber-700">{formatMoney(totalOwed)}</span>
          </p>
        </div>
        {canEdit && vendors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setEntry({ mode: "payment", vendorId: "" })}>
              <HandCoins className="h-4 w-4" /> To'lov
            </button>
            <button className="btn-primary" onClick={() => setEntry({ mode: "invoice", vendorId: "" })}>
              <FilePlus2 className="h-4 w-4" /> Hisob-faktura
            </button>
          </div>
        )}
      </div>

      <AsyncState
        loading={loading}
        empty={rows.length === 0}
        emptyLabel="Ta'minotchilar qo'shilmagan"
        emptyIcon={<Factory className="h-5 w-5" />}
      >
        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60">
              <tr>
                <th className="table-th">Ta'minotchi</th>
                <th className="table-th text-right">Hisob-fakturalar</th>
                <th className="table-th text-right">To'langan</th>
                <th className="table-th text-right">Qarzimiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => {
                const open = expanded === r.vendor.id;
                const ledger = [
                  ...r.invoices.map((i) => ({ key: `i-${i.id}`, date: i.date, kind: "invoice" as const, amount: i.amount, note: [i.order_number, i.note].filter(Boolean).join(" · "), id: i.id })),
                  ...r.payments.map((e) => ({ key: `p-${e.id}`, date: e.date, kind: "payment" as const, amount: e.amount, note: e.note, id: e.id })),
                ].sort((a, b) => b.date.localeCompare(a.date));
                return (
                  <Fragment key={r.vendor.id}>
                    <tr
                      key={r.vendor.id}
                      className="cursor-pointer hover:bg-ink-50/50"
                      onClick={() => setExpanded(open ? null : r.vendor.id)}
                    >
                      <td className="table-td font-medium text-ink-900">
                        <span className="inline-flex items-center gap-1.5">
                          {open ? <ChevronDown className="h-4 w-4 text-ink-400" /> : <ChevronRight className="h-4 w-4 text-ink-400" />}
                          {r.vendor.name}
                        </span>
                      </td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{formatMoney(r.invoiced)}</td>
                      <td className="table-td whitespace-nowrap text-right tabular-nums">{formatMoney(r.paid)}</td>
                      <td
                        className={`table-td whitespace-nowrap text-right font-semibold tabular-nums ${
                          r.balance > 0 ? "text-amber-700" : r.balance < 0 ? "text-emerald-700" : "text-ink-500"
                        }`}
                      >
                        {r.balance < 0 ? `Avans ${formatMoney(-r.balance)}` : formatMoney(r.balance)}
                      </td>
                    </tr>
                    {open && (
                      <tr key={`${r.vendor.id}-ledger`}>
                        <td colSpan={4} className="bg-ink-50/40 px-4 py-3">
                          {canEdit && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              <button className="btn-secondary !py-1.5 text-xs" onClick={() => setEntry({ mode: "invoice", vendorId: r.vendor.id })}>
                                <FilePlus2 className="h-3.5 w-3.5" /> Hisob-faktura
                              </button>
                              <button className="btn-secondary !py-1.5 text-xs" onClick={() => setEntry({ mode: "payment", vendorId: r.vendor.id })}>
                                <HandCoins className="h-3.5 w-3.5" /> To'lov
                              </button>
                            </div>
                          )}
                          {ledger.length === 0 ? (
                            <p className="text-xs text-ink-500">Hali yozuv yo'q</p>
                          ) : (
                            <table className="w-full text-xs">
                              <tbody className="divide-y divide-ink-100">
                                {ledger.map((l) => (
                                  <tr key={l.key}>
                                    <td className="py-1.5 pr-3 whitespace-nowrap text-ink-500">{formatDate(l.date)}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap">
                                      {l.kind === "invoice" ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Hisob-faktura</span>
                                      ) : (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">To'lov</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-3 text-ink-600">{l.note || "—"}</td>
                                    <td className="py-1.5 pr-3 whitespace-nowrap text-right font-semibold tabular-nums">
                                      {l.kind === "invoice" ? "+" : "−"}
                                      {formatMoney(l.amount)}
                                    </td>
                                    <td className="py-1.5 w-8 text-right">
                                      {l.kind === "invoice" && canDelete && (
                                        <button
                                          className="btn-ghost !p-1 text-rose-600 hover:bg-rose-50"
                                          onClick={() => removeInvoice(l.id)}
                                          aria-label="Hisob-fakturani o'chirish"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <p className="mt-2 text-[11px] text-ink-400">
                            To'lovlar "Xarajatlar" bo'limidagi "{VENDOR_EXPENSE_CATEGORY}" yozuvlaridan olinadi — ularni o'sha yerda tahrirlang.
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncState>

      <SupplierEntryModal
        entry={entry}
        vendors={vendors}
        onClose={() => setEntry(null)}
        onSaved={async (mode) => {
          setEntry(null);
          if (mode === "invoice") await loadOwn();
          else onChanged();
        }}
      />
    </div>
  );
}

type ModalProps = {
  entry: { mode: EntryMode; vendorId: string } | null;
  vendors: ProductionCompany[];
  onClose: () => void;
  onSaved: (mode: EntryMode) => void;
};

function SupplierEntryModal({ entry, vendors, onClose, onSaved }: ModalProps) {
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [orderNumber, setOrderNumber] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVendorId(entry?.vendorId || "");
    setAmount(0);
    setDate(todayISO());
    setOrderNumber("");
    setNote("");
    setError(null);
  }, [entry]);

  const isInvoice = entry?.mode === "invoice";

  const submit = async () => {
    if (!entry) return;
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return setError("Ta'minotchini tanlang");
    if (!amount || amount <= 0) return setError("Summa 0 dan katta bo'lishi kerak");
    setSaving(true);
    setError(null);
    try {
      if (isInvoice) {
        await insertOne<Omit<SupplierInvoice, "id" | "created_at">>("supplier_invoices", {
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          amount,
          date,
          order_number: orderNumber.trim(),
          note: note.trim(),
          created_by: user?.email || "",
        });
      } else {
        // A payment is an ordinary vendor expense, so it also shows up in
        // Xarajatlar and in the period's Chiqim.
        await insertOne("expenses", {
          category: VENDOR_EXPENSE_CATEGORY,
          amount,
          date,
          note: note.trim(),
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          created_by: user?.email || "",
        });
      }
      setSaving(false);
      onSaved(entry.mode);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={isInvoice ? "Ta'minotchi hisob-fakturasi" : "Ta'minotchiga to'lov"}
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
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4">
        <p className="text-xs text-ink-500">
          {isInvoice
            ? "Ta'minotchi bajargan ish uchun bergan hisobi — shu summaga qarzimiz oshadi."
            : "Ta'minotchiga to'langan pul — qarzimiz shu summaga kamayadi va Xarajatlarga ham yoziladi."}
        </p>
        <div>
          <label className="label">Ta'minotchi *</label>
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">-- tanlang --</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
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
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {isInvoice && (
          <div>
            <label className="label">Buyurtma raqami</label>
            <input
              className="input"
              placeholder="Masalan: VP-098"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label">Izoh</label>
          <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
