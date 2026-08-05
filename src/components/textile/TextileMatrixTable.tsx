import { TEXTILE_SIZES } from "../../lib/orderConstants";
import type { TextileMatrix } from "../../lib/textileMatrix";

export default function TextileMatrixTable({ matrix }: { matrix: TextileMatrix }) {
  const { rows, sizeTotals, grandTotal } = matrix;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
        Razmer/rang taqsimoti kiritilmagan
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full min-w-[640px] text-sm">
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
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.color}>
              <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink-800">
                {row.color}
              </td>
              {TEXTILE_SIZES.map((size) => (
                <td key={size} className="px-2 py-1.5 text-center text-ink-700">
                  {row.qty[size] || 0}
                </td>
              ))}
              <td className="bg-emerald-50 px-2 py-1.5 text-center font-semibold text-emerald-800">
                {row.total}
              </td>
              <td className="px-2 py-1.5 text-center text-ink-500">
                {grandTotal > 0 ? `${Math.round((row.total / grandTotal) * 100)}%` : "0%"}
              </td>
            </tr>
          ))}
        </tbody>
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
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
