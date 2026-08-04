import { useMemo, useRef, useState } from "react";
import { Calculator, Download } from "lucide-react";
import type { Product } from "../../lib/types";
import { tierPriceFor } from "../../lib/priceTiers";
import { formatDate, formatMoney } from "../../lib/format";
import { exportNodeToPng } from "../../lib/exportPng";

type Props = {
  products: Product[];
};

export default function PriceCalculator({ products }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === productId) || null;
  const unitPrice = useMemo(
    () => (product && quantity > 0 ? tierPriceFor(product.price_tiers, quantity) : 0),
    [product, quantity],
  );
  const total = unitPrice * quantity;

  const save = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      await exportNodeToPng(cardRef.current, `narx-${product?.name || "taklif"}-${quantity}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">
          Narx kalkulyatori
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label">Mahsulot</label>
          <select
            className="input"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">-- tanlang --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Miqdor</label>
          <input
            type="number"
            className="input"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {product && quantity > 0 && (
        <div className="mt-5">
          <div
            ref={cardRef}
            className="mx-auto max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
          >
            <div className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
              Narx taklifi
            </div>
            <div className="mt-2 text-center font-display text-lg font-bold text-ink-900">
              {product.name}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Miqdor</span>
                <span className="font-semibold text-ink-800">
                  {quantity} {product.unit || "dona"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">1 {product.unit || "dona"} narxi</span>
                <span className="font-semibold text-ink-800">{formatMoney(unitPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base">
                <span className="font-semibold text-ink-700">Jami</span>
                <span className="font-display font-extrabold text-emerald-700">
                  {formatMoney(total)}
                </span>
              </div>
            </div>
            <div className="mt-4 text-center text-[11px] text-ink-400">
              {formatDate(new Date().toISOString())}
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {saving ? "Saqlanmoqda..." : "Saqlash (rasm)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
