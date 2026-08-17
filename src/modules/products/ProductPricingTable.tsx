import { useEffect, useMemo, useState } from "react";
import { Lock, Wallet } from "lucide-react";
import type { CostTier, Product, ProductCost } from "../../lib/types";
import { getOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { canViewCostPrice } from "../../lib/rolePermissions";
import { buildTierRows, quoteForQuantity } from "../../lib/priceCalculations";
import { formatMoney } from "../../lib/format";

type Props = { product: Product };

export default function ProductPricingTable({ product }: Props) {
  const auth = useAuth();
  const showCost = canViewCostPrice(auth);
  const [costTiers, setCostTiers] = useState<CostTier[] | null>(null);
  const [quantity, setQuantity] = useState<number>(product.min_order_qty || 0);

  useEffect(() => {
    setCostTiers(null);
    if (!showCost) return;
    let cancelled = false;
    void getOne<ProductCost>("product_costs", product.id).then((c) => {
      if (!cancelled) setCostTiers(c?.cost_tiers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, showCost]);

  useEffect(() => {
    setQuantity(product.min_order_qty || product.price_tiers?.[0]?.min_qty || 0);
  }, [product.id, product.min_order_qty, product.price_tiers]);

  const rows = useMemo(
    () => buildTierRows(product.price_tiers || [], showCost ? costTiers : null),
    [product.price_tiers, showCost, costTiers],
  );

  const quote = useMemo(
    () => (quantity > 0 ? quoteForQuantity(product.price_tiers || [], showCost ? costTiers : null, quantity) : null),
    [product.price_tiers, showCost, costTiers, quantity],
  );

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">Narx pog'onasi</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50/60">
            <tr>
              <th className="table-th">Tiraj</th>
              <th className="table-th">Sotuv narxi (1 {product.unit || "dona"})</th>
              {showCost && (
                <th className="table-th">
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Lock className="h-3 w-3" /> Tan narxi (1 {product.unit || "dona"})
                  </span>
                </th>
              )}
              <th className="table-th">Jami sotuv narxi</th>
              {showCost && <th className="table-th">Jami tan narx</th>}
              {showCost && <th className="table-th">Marja</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.min_qty} className="hover:bg-ink-50/50">
                <td className="table-td font-semibold text-ink-800">{r.min_qty}+</td>
                <td className="table-td">{formatMoney(r.unit_price)}</td>
                {showCost && (
                  <td className="table-td text-amber-700">
                    {r.unit_cost !== null ? formatMoney(r.unit_cost) : "-"}
                  </td>
                )}
                <td className="table-td font-medium text-ink-900">{formatMoney(r.total_price)}</td>
                {showCost && (
                  <td className="table-td text-amber-700">
                    {r.total_cost !== null ? formatMoney(r.total_cost) : "-"}
                  </td>
                )}
                {showCost && (
                  <td className="table-td">
                    {r.margin !== null ? (
                      <span
                        className={`chip ${r.margin >= 30 ? "bg-emerald-100 text-emerald-700" : r.margin >= 15 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}
                      >
                        +{r.margin.toFixed(1)}%
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showCost ? 6 : 3} className="table-td text-center text-ink-400">
                  Narx pog'onasi kiritilmagan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-ink-50/60 p-3">
        <div>
          <label className="label">Tiraj tanlang</label>
          <input
            type="number"
            className="input w-32"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
        </div>
        {quote && (
          <>
            <MiniStat label="Sotuv narxi (jami)" value={formatMoney(quote.totalPrice)} />
            {showCost && quote.totalCost !== null && (
              <>
                <MiniStat label="Tan narxi (jami)" value={formatMoney(quote.totalCost)} tone="amber" />
                <MiniStat
                  label="Foyda"
                  value={formatMoney(quote.profit ?? 0)}
                  sub={quote.margin !== null ? `${quote.margin.toFixed(1)}%` : undefined}
                  tone="emerald"
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : "text-ink-900";
  return (
    <div className="rounded-xl border border-ink-200 bg-surface px-3 py-2">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className={`text-sm font-bold ${toneCls}`}>
        {value} {sub && <span className="ml-1 text-xs font-semibold">({sub})</span>}
      </div>
    </div>
  );
}
