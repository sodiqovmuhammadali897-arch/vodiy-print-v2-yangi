import { ListChecks } from "lucide-react";
import type { Product } from "../../lib/types";

type Props = { product: Product };

export default function ProductSpecs({ product }: Props) {
  const rows: [string, string][] = [
    ["Mahsulot turi", product.category || "-"],
    ["O'lchov birligi", product.unit || "dona"],
  ];
  if (product.size_spec) rows.push(["O'lcham", product.size_spec]);
  if (product.material) rows.push(["Material", product.material]);
  if (product.print_type) rows.push(["Bosma turi", product.print_type]);
  if (product.paper_weight) rows.push(["Qog'oz qalinligi", product.paper_weight]);
  if (product.lamination) rows.push(["Laminatsiya", product.lamination]);
  if (product.packaging) rows.push(["Qadoqlash", product.packaging]);
  if (product.sizes?.length) rows.push(["Razmerlar", product.sizes.join(", ")]);
  if (product.colors?.length) rows.push(["Ranglar", product.colors.join(", ")]);
  if (product.spec_note) rows.push(["Izoh", product.spec_note]);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">Mahsulot ma'lumotlari</h2>
      </div>
      <dl className="divide-y divide-ink-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2 text-sm">
            <dt className="text-ink-500">{label}</dt>
            <dd className="text-right font-medium text-ink-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
