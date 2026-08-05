import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TEXTILE_COLORS, TEXTILE_SIZES } from "../../lib/orderConstants";
import { emptySizeMatrixQty, type SizeMatrixRow } from "../../lib/textileMatrix";

type Props = {
  rows: SizeMatrixRow[];
  onChange: (rows: SizeMatrixRow[]) => void;
};

export default function TextileMatrixEditor({ rows, onChange }: Props) {
  const [newColor, setNewColor] = useState("");

  const sizeTotals = emptySizeMatrixQty();
  for (const row of rows) {
    for (const size of TEXTILE_SIZES) sizeTotals[size] += Number(row.qty[size]) || 0;
  }
  const grandTotal = TEXTILE_SIZES.reduce((s, size) => s + sizeTotals[size], 0);
  const rowTotal = (row: SizeMatrixRow) =>
    TEXTILE_SIZES.reduce((s, size) => s + (Number(row.qty[size]) || 0), 0);
  const activeColorCount = rows.filter((r) => rowTotal(r) > 0).length;
  const activeSizeCount = TEXTILE_SIZES.filter((s) => sizeTotals[s] > 0).length;

  const setCell = (color: string, size: string, value: number) => {
    onChange(rows.map((r) => (r.color === color ? { ...r, qty: { ...r.qty, [size]: value } } : r)));
  };

  const addColorRow = (color: string) => {
    const c = color.trim();
    if (!c || rows.some((r) => r.color === c)) return;
    onChange([...rows, { color: c, qty: emptySizeMatrixQty() }]);
    setNewColor("");
  };

  const removeColorRow = (color: string) => onChange(rows.filter((r) => r.color !== color));

  const clearAll = () => onChange(rows.map((r) => ({ ...r, qty: emptySizeMatrixQty() })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
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
        <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={clearAll}>
          Tozalash
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
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
          <div className="text-xs font-semibold uppercase text-emerald-700">Jami soni</div>
          <div className="font-display text-xl font-bold text-emerald-900">{grandTotal} dona</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
          <div className="text-xs font-semibold uppercase text-emerald-700">Ranglar soni</div>
          <div className="font-display text-xl font-bold text-emerald-900">{activeColorCount} ta</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
          <div className="text-xs font-semibold uppercase text-emerald-700">Razmerlar soni</div>
          <div className="font-display text-xl font-bold text-emerald-900">{activeSizeCount} ta</div>
        </div>
      </div>
    </div>
  );
}
