import { useState } from "react";
import { Trash2, GripVertical, Grid3x3, Pencil, X } from "lucide-react";
import type { WizardProduct } from "../../../lib/orderService";
import type { SizeBreakdownEntry } from "../../../lib/types";
import {
  CATEGORY_PRODUCTS,
  PRODUCT_CATEGORIES,
  PRODUCTION_COMPANIES,
  TEXTILE_COLORS,
  TEXTILE_SIZES,
} from "../../../lib/orderConstants";
import { computeProductTotal } from "../../../lib/orderCalculations";
import { formatMoney } from "../../../lib/format";
import TextileSizeMatrixModal from "./TextileSizeMatrixModal";

type Props = {
  index: number;
  product: WizardProduct;
  onChange: (patch: Partial<WizardProduct>) => void;
  onRemove: () => void;
  historyPrice?: number | null;
};

export default function ProductLineItem({
  index,
  product,
  onChange,
  onRemove,
  historyPrice,
}: Props) {
  const total = computeProductTotal(product);
  const suggestions = CATEGORY_PRODUCTS[product.category] || [];
  const isTextile = product.category === "Textil";
  const [matrixOpen, setMatrixOpen] = useState(false);
  const hasBreakdown = product.size_breakdown.length > 0;

  const patchAndRecalc = (patch: Partial<WizardProduct>) => {
    const merged = { ...product, ...patch };
    const newTotal = computeProductTotal(merged);
    onChange({ ...patch, total: newTotal });
  };

  const applyBreakdown = (breakdown: SizeBreakdownEntry[]) => {
    const qty = breakdown.reduce((s, e) => s + e.qty, 0);
    patchAndRecalc({ size_breakdown: breakdown, quantity: qty, color: "", size: "" });
  };

  const clearBreakdown = () =>
    patchAndRecalc({ size_breakdown: [], quantity: 0 });

  const colorCount = new Set(product.size_breakdown.map((e) => e.color)).size;
  const sizeCount = new Set(product.size_breakdown.map((e) => e.size)).size;

  return (
    <div className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-500">
          <GripVertical className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Mahsulot {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-base font-bold text-ink-900">
            {formatMoney(total)}
          </span>
          <button
            onClick={onRemove}
            className="btn-ghost text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-3">
          <label className="label">Kategoriya</label>
          <select
            className="input"
            value={product.category}
            onChange={(e) => patchAndRecalc({ category: e.target.value })}
          >
            <option value="">-- tanlang --</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-12 md:col-span-4">
          <label className="label">Mahsulot nomi</label>
          <input
            className="input"
            list={`products-${index}`}
            value={product.product_name}
            onChange={(e) => patchAndRecalc({ product_name: e.target.value })}
          />
          <datalist id={`products-${index}`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Variant</label>
          <input
            className="input"
            value={product.variant}
            onChange={(e) => patchAndRecalc({ variant: e.target.value })}
          />
        </div>
        {isTextile && hasBreakdown ? (
          <div className="col-span-12 md:col-span-6">
            <label className="label">Razmer/rang taqsimoti</label>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="text-sm text-emerald-800">
                <span className="font-semibold">{product.quantity} dona</span>
                {" · "}
                {colorCount} rang · {sizeCount} razmer
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setMatrixOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn-ghost text-rose-600 hover:bg-rose-50"
                  onClick={clearBreakdown}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="col-span-6 md:col-span-3">
              <label className="label">Rangi</label>
              {isTextile ? (
                <>
                  <input
                    className="input"
                    list={`colors-${index}`}
                    value={product.color}
                    onChange={(e) => patchAndRecalc({ color: e.target.value })}
                  />
                  <datalist id={`colors-${index}`}>
                    {TEXTILE_COLORS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              ) : (
                <input
                  className="input"
                  value={product.color}
                  onChange={(e) => patchAndRecalc({ color: e.target.value })}
                />
              )}
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className="label">O'lchami</label>
              {isTextile ? (
                <select
                  className="input"
                  value={product.size}
                  onChange={(e) => patchAndRecalc({ size: e.target.value })}
                >
                  <option value="">-- tanlang --</option>
                  {TEXTILE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={product.size}
                  onChange={(e) => patchAndRecalc({ size: e.target.value })}
                />
              )}
            </div>
            {isTextile && (
              <div className="col-span-12 -mt-1">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 hover:underline"
                  onClick={() => setMatrixOpen(true)}
                >
                  <span className="inline-flex items-center gap-1">
                    <Grid3x3 className="h-3.5 w-3.5" /> Bir nechta razmer/rang
                    uchun jadval orqali kiritish
                  </span>
                </button>
              </div>
            )}
          </>
        )}
        <div className="col-span-6 md:col-span-3">
          <label className="label">Materiali</label>
          <input
            className="input"
            value={product.material}
            onChange={(e) => patchAndRecalc({ material: e.target.value })}
          />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Ishlab chiqaruvchi</label>
          <select
            className="input"
            value={product.production_company || ""}
            onChange={(e) => onChange({ production_company: e.target.value })}
          >
            <option value="">-- tanlang --</option>
            {PRODUCTION_COMPANIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-4 md:col-span-2">
          <label className="label">Soni</label>
          <input
            type="number"
            className="input"
            value={product.quantity || ""}
            disabled={hasBreakdown}
            onChange={(e) =>
              patchAndRecalc({ quantity: Number(e.target.value) || 0 })
            }
          />
          {hasBreakdown && (
            <div className="mt-1 text-[11px] text-ink-500">Jadvaldan hisoblanadi</div>
          )}
        </div>
        <div className="col-span-4 md:col-span-2">
          <label className="label">Dona narxi</label>
          <input
            type="number"
            className="input"
            value={product.unit_price || ""}
            onChange={(e) =>
              patchAndRecalc({ unit_price: Number(e.target.value) || 0 })
            }
          />
          {historyPrice != null && historyPrice > 0 && (
            <div className="mt-1 text-[11px] text-ink-500">
              Oldingi narx: {formatMoney(historyPrice)}
            </div>
          )}
        </div>
        <div className="col-span-4 md:col-span-2">
          <label className="label">Chegirma</label>
          <input
            type="number"
            className="input"
            value={product.discount || ""}
            onChange={(e) =>
              patchAndRecalc({ discount: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="col-span-12">
          <label className="label">Izoh</label>
          <input
            className="input"
            value={product.note}
            onChange={(e) => patchAndRecalc({ note: e.target.value })}
          />
        </div>
      </div>

      {isTextile && (
        <TextileSizeMatrixModal
          open={matrixOpen}
          onClose={() => setMatrixOpen(false)}
          productName={product.product_name}
          initialBreakdown={product.size_breakdown}
          onSave={applyBreakdown}
        />
      )}
    </div>
  );
}
