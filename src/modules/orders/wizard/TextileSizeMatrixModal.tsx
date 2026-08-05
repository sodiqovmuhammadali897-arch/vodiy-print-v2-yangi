import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Upload, FolderDown } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { TEXTILE_COLORS, TEXTILE_SIZES } from "../../../lib/orderConstants";
import { insertOne, listAll, listWhere } from "../../../lib/firestoreDb";
import type { Order, OrderProduct, SizeBreakdownEntry, TextileSizeTemplate } from "../../../lib/types";
import { useAuth } from "../../../lib/AuthContext";

type Row = { color: string; qty: Record<string, number> };

const emptyQty = (): Record<string, number> =>
  Object.fromEntries(TEXTILE_SIZES.map((s) => [s, 0]));

const breakdownToRows = (breakdown: SizeBreakdownEntry[]): Row[] => {
  const byColor = new Map<string, Row>();
  for (const entry of breakdown) {
    if (!byColor.has(entry.color)) {
      byColor.set(entry.color, { color: entry.color, qty: emptyQty() });
    }
    const row = byColor.get(entry.color)!;
    if (TEXTILE_SIZES.includes(entry.size as (typeof TEXTILE_SIZES)[number])) {
      row.qty[entry.size] = Number(entry.qty) || 0;
    }
  }
  return Array.from(byColor.values());
};

const rowsToBreakdown = (rows: Row[]): SizeBreakdownEntry[] => {
  const out: SizeBreakdownEntry[] = [];
  for (const row of rows) {
    for (const size of TEXTILE_SIZES) {
      const qty = Number(row.qty[size]) || 0;
      if (qty > 0) out.push({ color: row.color, size, qty });
    }
  }
  return out;
};

type Props = {
  open: boolean;
  onClose: () => void;
  productName: string;
  initialBreakdown: SizeBreakdownEntry[];
  onSave: (breakdown: SizeBreakdownEntry[]) => void;
};

export default function TextileSizeMatrixModal({
  open,
  onClose,
  productName,
  initialBreakdown,
  onSave,
}: Props) {
  const { user, staff } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [newColor, setNewColor] = useState("");
  const [loadOrderNumber, setLoadOrderNumber] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [templates, setTemplates] = useState<TextileSizeTemplate[]>([]);
  const [templateChoice, setTemplateChoice] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(breakdownToRows(initialBreakdown));
    setNewColor("");
    setLoadOrderNumber("");
    setLoadError(null);
    setTemplateChoice("");
    void listAll<TextileSizeTemplate>("textile_size_templates", {
      orderBy: ["created_at", "desc"],
    }).then(setTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sizeTotals = useMemo(() => {
    const totals = emptyQty();
    for (const row of rows) {
      for (const size of TEXTILE_SIZES) {
        totals[size] += Number(row.qty[size]) || 0;
      }
    }
    return totals;
  }, [rows]);

  const grandTotal = useMemo(
    () => TEXTILE_SIZES.reduce((s, size) => s + sizeTotals[size], 0),
    [sizeTotals],
  );

  const rowTotal = (row: Row) =>
    TEXTILE_SIZES.reduce((s, size) => s + (Number(row.qty[size]) || 0), 0);

  const activeColorCount = rows.filter((r) => rowTotal(r) > 0).length;
  const activeSizeCount = TEXTILE_SIZES.filter((s) => sizeTotals[s] > 0).length;

  const setCell = (color: string, size: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.color === color ? { ...r, qty: { ...r.qty, [size]: value } } : r)),
    );
  };

  const addColorRow = (color: string) => {
    const c = color.trim();
    if (!c || rows.some((r) => r.color === c)) return;
    setRows((prev) => [...prev, { color: c, qty: emptyQty() }]);
    setNewColor("");
  };

  const removeColorRow = (color: string) =>
    setRows((prev) => prev.filter((r) => r.color !== color));

  const clearAll = () => setRows((prev) => prev.map((r) => ({ ...r, qty: emptyQty() })));

  const loadByOrderId = async () => {
    const num = loadOrderNumber.trim();
    if (!num) return;
    setLoadingOrder(true);
    setLoadError(null);
    try {
      const orders = await listWhere<Order>("orders", "order_number", num);
      const order = orders[0];
      if (!order) {
        setLoadError("Bunday raqamli buyurtma topilmadi");
        return;
      }
      const products = await listWhere<OrderProduct>("order_products", "order_id", order.id);
      const withBreakdown = products.find(
        (p) => Array.isArray(p.size_breakdown) && p.size_breakdown.length > 0,
      );
      if (!withBreakdown) {
        setLoadError("Bu buyurtmada razmer/rang taqsimoti topilmadi");
        return;
      }
      setRows(breakdownToRows(withBreakdown.size_breakdown));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setLoadingOrder(false);
    }
  };

  const saveAsTemplate = async () => {
    const name = prompt("Shablon nomi (masalan: Alpha School - Futbolka)");
    if (!name || !name.trim()) return;
    setSavingTemplate(true);
    try {
      await insertOne("textile_size_templates", {
        name: name.trim(),
        product_name: productName,
        size_breakdown: rowsToBreakdown(rows),
        created_by: staff?.full_name || user?.email || "",
        created_at: new Date().toISOString(),
      });
      const fresh = await listAll<TextileSizeTemplate>("textile_size_templates", {
        orderBy: ["created_at", "desc"],
      });
      setTemplates(fresh);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Shablonni saqlab bo'lmadi");
    } finally {
      setSavingTemplate(false);
    }
  };

  const loadTemplate = (id: string) => {
    setTemplateChoice(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setRows(breakdownToRows(tpl.size_breakdown));
  };

  const save = () => {
    onSave(rowsToBreakdown(rows));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Razmer va ranglar taqsimoti"
      description={productName || undefined}
      size="xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={save}>
            <Save className="h-4 w-4" /> Saqlash
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">ID orqali yuklash</label>
            <div className="flex gap-1">
              <input
                className="input w-36"
                placeholder="VP-00231"
                value={loadOrderNumber}
                onChange={(e) => setLoadOrderNumber(e.target.value)}
              />
              <button
                className="btn-secondary"
                onClick={loadByOrderId}
                disabled={loadingOrder}
              >
                <Upload className="h-4 w-4" /> Yuklash
              </button>
            </div>
          </div>
          <div>
            <label className="label">Shablondan yuklash</label>
            <select
              className="input w-56"
              value={templateChoice}
              onChange={(e) => loadTemplate(e.target.value)}
            >
              <option value="">-- shablon tanlang --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-secondary"
            onClick={saveAsTemplate}
            disabled={savingTemplate || rows.length === 0}
          >
            <FolderDown className="h-4 w-4" /> Shablon sifatida saqlash
          </button>
          <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={clearAll}>
            Tozalash
          </button>
        </div>
        {loadError && <p className="text-xs text-rose-600">{loadError}</p>}

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className="label">Rang qo'shish</label>
            <input
              className="input"
              list="matrix-color-suggestions"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addColorRow(newColor);
              }}
              placeholder="Rang nomi..."
            />
            <datalist id="matrix-color-suggestions">
              {TEXTILE_COLORS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <button className="btn-secondary" onClick={() => addColorRow(newColor)}>
            <Plus className="h-4 w-4" /> Qator qo'shish
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink-100">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-emerald-700 text-white">
                <th className="px-3 py-2 text-left font-semibold">Rang</th>
                {TEXTILE_SIZES.map((s) => (
                  <th key={s} className="px-2 py-2 text-center font-semibold">
                    {s}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold">Jami</th>
                <th className="px-2 py-2 text-center font-semibold">%</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={TEXTILE_SIZES.length + 3} className="px-3 py-6 text-center text-ink-400">
                    Rang qo'shib, jadvalni to'ldiring
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const total = rowTotal(row);
                return (
                  <tr key={row.color}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink-800">
                      {row.color}
                    </td>
                    {TEXTILE_SIZES.map((size) => (
                      <td key={size} className="px-1 py-1">
                        <input
                          type="number"
                          min={0}
                          className="w-16 rounded-lg border border-ink-200 px-1.5 py-1 text-center text-sm"
                          value={row.qty[size] || ""}
                          onChange={(e) =>
                            setCell(row.color, size, Math.max(0, Number(e.target.value) || 0))
                          }
                        />
                      </td>
                    ))}
                    <td className="bg-emerald-50 px-2 py-1.5 text-center font-semibold text-emerald-800">
                      {total}
                    </td>
                    <td className="px-2 py-1.5 text-center text-ink-500">
                      {grandTotal > 0 ? `${Math.round((total / grandTotal) * 100)}%` : "0%"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        className="btn-ghost text-rose-600 hover:bg-rose-50"
                        onClick={() => removeColorRow(row.color)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-700 font-bold text-white">
                  <td className="px-3 py-2">JAMI</td>
                  {TEXTILE_SIZES.map((size) => (
                    <td key={size} className="px-2 py-2 text-center">
                      {sizeTotals[size]}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">{grandTotal}</td>
                  <td className="px-2 py-2 text-center">100%</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-ink-500">Jami soni</div>
            <div className="font-display text-xl font-bold text-ink-900">{grandTotal} dona</div>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-ink-500">Ranglar soni</div>
            <div className="font-display text-xl font-bold text-ink-900">{activeColorCount} ta</div>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-ink-500">Razmerlar soni</div>
            <div className="font-display text-xl font-bold text-ink-900">{activeSizeCount} ta</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
