import { Archive, Copy, ImageOff, Pencil, Power, RotateCcw, Trash2 } from "lucide-react";
import type { Product, ProductVendor } from "../../lib/types";

type Props = {
  product: Product;
  primaryVendor: ProductVendor | null;
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
};

export default function ProductHeader({
  product,
  primaryVendor,
  canEdit,
  isAdmin,
  onEdit,
  onDuplicate,
  onToggleActive,
  onToggleArchive,
  onDelete,
}: Props) {
  const archived = !!product.archived_at;
  const active = product.is_active !== false && !archived;

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink-100 text-ink-400">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink-900">{product.name}</h1>
              <span
                className={`chip ${
                  archived
                    ? "bg-ink-200 text-ink-700"
                    : active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                }`}
              >
                {archived ? "Arxivda" : active ? "Faol" : "Nofaol"}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-500">{product.category || "-"} mahsulotlari</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Tahrirlash
            </button>
            <button className="btn-ghost" onClick={onDuplicate} title="Nusxa olish">
              <Copy className="h-4 w-4" /> Nusxa olish
            </button>
            <button
              className="btn-ghost"
              onClick={onToggleArchive}
              title={archived ? "Arxivdan chiqarish" : "Arxivlash"}
            >
              {archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {archived ? "Arxivdan chiqarish" : "Arxivlash"}
            </button>
            {!archived && (
              <button
                className={`btn-ghost ${active ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                onClick={onToggleActive}
              >
                <Power className="h-4 w-4" /> {active ? "Nofaollashtirish" : "Faollashtirish"}
              </button>
            )}
            {isAdmin && (
              <button className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> O'chirish
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4">
        <QuickInfo label="Ishlab chiqaruvchi (asosiy)" value={primaryVendor?.company_name || "-"} />
        <QuickInfo
          label="Tayyor bo'lish muddati"
          value={
            primaryVendor?.lead_time_days
              ? `${primaryVendor.lead_time_days} ish kuni`
              : product.lead_time_days
                ? `${product.lead_time_days} ish kuni`
                : "-"
          }
        />
        <QuickInfo
          label="Minimal tiraj"
          value={product.min_order_qty ? `${product.min_order_qty} ${product.unit || "dona"}` : "-"}
        />
        <QuickInfo label="Mahsulot kodi" value={product.product_code || "-"} />
      </div>
    </div>
  );
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50/60 px-3 py-2">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}
