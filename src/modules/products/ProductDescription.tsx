import { Check, FileText, Lightbulb, Sparkles } from "lucide-react";
import type { Product } from "../../lib/types";

type Props = {
  product: Product;
  allProducts: Product[];
  onSelectUpsell?: (p: Product) => void;
};

export default function ProductDescription({ product, allProducts, onSelectUpsell }: Props) {
  const upsellProducts = (product.upsell_product_ids || [])
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is Product => !!p);

  const hasAnything =
    product.description ||
    product.advantages?.length ||
    product.recommended_for?.length ||
    product.sales_notes ||
    product.manager_tip ||
    upsellProducts.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">Mahsulot tavsifi</h2>
      </div>

      {product.description && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{product.description}</p>
      )}

      {product.advantages?.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {product.advantages.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {a}
            </li>
          ))}
        </ul>
      )}

      {product.recommended_for?.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Tavsiya etiladigan sohalar
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.recommended_for.map((r) => (
              <span key={r} className="chip bg-ink-100 text-ink-700">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {product.sales_notes && (
        <div className="mt-4 rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            Muhim sotuv izohlari
          </div>
          {product.sales_notes}
        </div>
      )}

      {product.manager_tip && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Manager uchun tavsiya
            </div>
            {product.manager_tip}
          </div>
        </div>
      )}

      {upsellProducts.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <Sparkles className="h-3.5 w-3.5" /> Upsell mahsulotlar
          </div>
          <div className="flex flex-wrap gap-1.5">
            {upsellProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectUpsell?.(p)}
                className="chip bg-brand-50 text-brand-700 hover:bg-brand-100"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
