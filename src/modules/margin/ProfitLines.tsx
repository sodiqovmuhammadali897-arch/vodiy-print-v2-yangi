import { formatMoney } from "../../lib/format";
import type { profitBreakdown } from "../../lib/margin";

// Aylanma − tannarx = yalpi foyda; − boshqa xarajatlar = sof foyda (Moliya
// and Hisobot, admin-only). See lib/margin.ts.
export default function ProfitLines({ b }: { b: ReturnType<typeof profitBreakdown> }) {
  const line = (label: string, value: number, cls = "") => (
    <div className={`flex justify-between gap-4 border-b border-dashed border-ink-200 py-1.5 ${cls}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
  if (b.mode === "cash") {
    return (
      <div className="text-sm text-ink-700">
        {line("Kirim (buyurtmalar)", b.revenue)}
        {line("− Barcha xarajatlar", b.otherExpenses)}
        {line("= Sof foyda", b.net, "font-bold")}
        <p className="mt-2 text-xs text-amber-800">
          Bu davr uchun Marja panelida hali tannarx kiritilmagan — foyda kirim minus barcha xarajatlar bo'yicha. Tannarx kiritilgach, yalpi foyda va aniq sof
          foyda chiqadi.
        </p>
      </div>
    );
  }
  const pct = b.revenue > 0 ? (b.gross / b.revenue) * 100 : 0;
  return (
    <div className="text-sm text-ink-700">
      {line("Kirim (buyurtmalar)", b.revenue)}
      {line(`− Tannarx (${b.costedLines} / ${b.lines} qator)`, b.cost)}
      {line(`= Yalpi foyda (${pct.toFixed(1)}%)`, b.gross, "font-semibold text-emerald-700")}
      {line("− Boshqa xarajatlar (ijara, maosh, reklama…)", b.otherExpenses)}
      <div className="py-1 text-xs text-ink-500">"Ta'minotchiga to'lov" va "Xomashyo" ({formatMoney(b.costExpenses)}) qo'shilmaydi — ular tannarxda bor.</div>
      <div className="flex justify-between gap-4 py-2 text-base font-extrabold">
        <span>= Sof foyda</span>
        <span className={`tabular-nums ${b.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatMoney(b.net)}</span>
      </div>
      {b.missingLines > 0 && (
        <p className="text-xs text-amber-800">
          ⚠️ {b.missingLines} qatorning tannarxi kiritilmagan ({formatMoney(b.missingRevenue)} kirim) — sof foyda shu qismning tannarxisiz hisoblangan.
        </p>
      )}
    </div>
  );
}
