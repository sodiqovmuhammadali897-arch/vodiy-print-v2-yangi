import { Trash2, GripVertical } from "lucide-react";
import type { WizardProduct } from "../../../lib/orderService";
import {
  CATEGORY_PRODUCTS,
  PRODUCT_CATEGORIES,
} from "../../../lib/orderConstants";
import { computeProductTotal } from "../../../lib/orderCalculations";
import { formatMoney } from "../../../lib/format";

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

  const patchAndRecalc = (patch: Partial<WizardProduct>) => {
    const merged = { ...product, ...patch };
    const newTotal = computeProductTotal(merged);
    onChange({ ...patch, total: newTotal });
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
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
        <div className="col-span-6 md:col-span-3">
          <label className="label">Rangi</label>
          <input
            className="input"
            value={product.color}
            onChange={(e) => patchAndRecalc({ color: e.target.value })}
          />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">O'lchami</label>
          <input
            className="input"
            value={product.size}
            onChange={(e) => patchAndRecalc({ size: e.target.value })}
          />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Materiali</label>
          <input
            className="input"
            value={product.material}
            onChange={(e) => patchAndRecalc({ material: e.target.value })}
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <label className="label">Soni</label>
          <input
            type="number"
            className="input"
            value={product.quantity || ""}
            onChange={(e) =>
              patchAndRecalc({ quantity: Number(e.target.value) || 0 })
            }
          />
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
    </div>
  );
}
