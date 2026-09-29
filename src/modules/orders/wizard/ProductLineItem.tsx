import { useState } from "react";
import { Trash2, GripVertical, Grid3x3, Pencil, X, Plus, ExternalLink, Paperclip, RotateCcw } from "lucide-react";
import type { WizardFileLink, WizardProduct } from "../../../lib/orderService";
import type { PriceTier, Product, SizeBreakdownEntry } from "../../../lib/types";
import { sortTiers, tierPriceFor } from "../../../lib/priceTiers";
import {
  FILE_LINK_TYPES,
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
  catalog: Product[];
  onChange: (patch: Partial<WizardProduct>) => void;
  onRemove: () => void;
  historyPrice?: number | null;
};

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// The tier a quantity falls in, and the next one up (to suggest "a bit
// more and it's cheaper").
const tierInfo = (tiers: PriceTier[], qty: number) => {
  const sorted = sortTiers(tiers);
  const current = [...sorted].reverse().find((t) => qty >= t.min_qty) || null;
  const next = sorted.find((t) => t.min_qty > qty) || null;
  return { sorted, current, next, belowMin: sorted.length > 0 && qty > 0 && qty < sorted[0].min_qty };
};

export default function ProductLineItem({
  index,
  product,
  catalog,
  onChange,
  onRemove,
  historyPrice,
}: Props) {
  const total = computeProductTotal(product);
  const isTextile = product.category === "Textil";
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const hasBreakdown = product.size_breakdown.length > 0;

  const patchAndRecalc = (patch: Partial<WizardProduct>) => {
    const merged = { ...product, ...patch };
    const newTotal = computeProductTotal(merged);
    onChange({ ...patch, total: newTotal });
  };

  // ── catalog link ────────────────────────────────────────────────
  const linked = product.catalog_product_id ? catalog.find((p) => p.id === product.catalog_product_id) || null : null;
  const tiers = linked?.price_tiers || [];
  const catalogPriceFor = (qty: number) => (tiers.length ? tierPriceFor(tiers, qty || sortTiers(tiers)[0].min_qty) : 0);
  const catalogPrice = linked && tiers.length ? catalogPriceFor(product.quantity) : null;
  const info = tierInfo(tiers, product.quantity);

  const inCategory = product.category ? catalog.filter((p) => p.category === product.category) : catalog;
  const pool = inCategory.length ? inCategory : catalog;
  const query = normName(product.product_name);
  const matches = (linked && normName(linked.name) === query ? pool : pool.filter((p) => !query || normName(p.name).includes(query))).slice(0, 40);

  const pickProduct = (p: Product) => {
    const t = p.price_tiers || [];
    patchAndRecalc({
      product_name: p.name,
      catalog_product_id: p.id,
      category: p.category || product.category,
      size: product.size || p.size_spec || "",
      material: product.material || p.material || "",
      unit_price: t.length ? tierPriceFor(t, product.quantity || sortTiers(t)[0].min_qty) : product.unit_price,
      price_manual: false,
    });
    setPickerOpen(false);
  };

  const onNameChange = (text: string) => {
    const exact = catalog.find((p) => normName(p.name) === normName(text));
    patchAndRecalc({ product_name: text, catalog_product_id: exact ? exact.id : null });
    setPickerOpen(true);
    setHighlight(0);
  };

  // Quantity drives the price while the manager hasn't set their own.
  const priceForQty = (qty: number): Partial<WizardProduct> =>
    linked && tiers.length && !product.price_manual ? { unit_price: catalogPriceFor(qty) } : {};

  const applyBreakdown = (breakdown: SizeBreakdownEntry[]) => {
    const qty = breakdown.reduce((s, e) => s + e.qty, 0);
    patchAndRecalc({ size_breakdown: breakdown, quantity: qty, color: "", size: "", ...priceForQty(qty) });
  };

  const clearBreakdown = () =>
    patchAndRecalc({ size_breakdown: [], quantity: 0 });

  const colorCount = new Set(product.size_breakdown.map((e) => e.color)).size;
  const sizeCount = new Set(product.size_breakdown.map((e) => e.size)).size;

  const files = product.files || [];
  const addFile = () =>
    onChange({ files: [...files, { filename: "", url: "", link_type: "Boshqa", note: "" }] });
  const updateFile = (i: number, patch: Partial<WizardFileLink>) =>
    onChange({ files: files.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const removeFile = (i: number) => onChange({ files: files.filter((_, idx) => idx !== i) });

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
          <div className="relative">
            <input
              className="input"
              value={product.product_name}
              placeholder={catalog.length ? "Katalogdan tanlang yoki yozing" : ""}
              onFocus={() => setPickerOpen(true)}
              onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (!pickerOpen || !matches.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(matches.length - 1, h + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  pickProduct(matches[Math.min(highlight, matches.length - 1)]);
                } else if (e.key === "Escape") setPickerOpen(false);
              }}
            />
            {pickerOpen && catalog.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-ink-100 bg-surface py-1 shadow-lg">
                {matches.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-ink-500">Katalogda topilmadi — shu nom bilan davom etishingiz mumkin</div>
                ) : (
                  matches.map((p, i) => {
                    const t = sortTiers(p.price_tiers || []);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => pickProduct(p)}
                        className={`block w-full px-3 py-2 text-left text-sm ${i === highlight ? "bg-brand-50" : "hover:bg-ink-50"}`}
                      >
                        <span className="block font-semibold text-ink-900">{p.name}</span>
                        <span className="block text-[11px] tabular-nums text-ink-500">
                          {!product.category && p.category ? `${p.category} · ` : ""}
                          {t.length === 0
                            ? "narx kiritilmagan"
                            : t.length > 1
                              ? `${t[0].min_qty}+ ta: ${formatMoney(t[0].price)} → ${t[t.length - 1].min_qty}+ ta: ${formatMoney(t[t.length - 1].price)}`
                              : `${t[0].min_qty}+ ta: ${formatMoney(t[0].price)}`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {linked && <div className="mt-1 text-[11px] font-semibold text-emerald-700">✓ Katalogdan — narx tirajga qarab qo'yiladi</div>}
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
            onChange={(e) => {
              const qty = Number(e.target.value) || 0;
              patchAndRecalc({ quantity: qty, ...priceForQty(qty) });
            }}
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
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              // Once the manager writes their own price, quantity changes
              // no longer overwrite it.
              patchAndRecalc({ unit_price: v, ...(linked ? { price_manual: v !== catalogPrice } : {}) });
            }}
          />
          {linked && info.sorted.length > 0 && (
            <div className="mt-1 space-y-0.5 text-[11px] leading-tight">
              {info.belowMin ? (
                <div className="font-semibold text-amber-700">Minimal tiraj — {info.sorted[0].min_qty} ta</div>
              ) : info.current ? (
                <div className="text-ink-500">
                  Katalog: {info.current.min_qty}+ — {formatMoney(info.current.price)}
                </div>
              ) : null}
              {product.price_manual && catalogPrice !== null && product.unit_price !== catalogPrice && (
                <button
                  type="button"
                  className="block text-left font-semibold text-brand-700 hover:underline"
                  onClick={() => patchAndRecalc({ unit_price: catalogPrice, price_manual: false })}
                >
                  <RotateCcw className="mr-1 inline h-3 w-3 align-[-2px]" />
                  Katalog narxi: {formatMoney(catalogPrice)}
                  {catalogPrice > 0 && ` (siz ${product.unit_price < catalogPrice ? "−" : "+"}${Math.abs(Math.round(((product.unit_price - catalogPrice) / catalogPrice) * 100))}%)`}
                </button>
              )}
              {info.next && product.quantity > 0 && !info.belowMin && (
                <div className="text-emerald-700">
                  Yana {info.next.min_qty - product.quantity} ta → {formatMoney(info.next.price)}
                </div>
              )}
            </div>
          )}
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

      <div className="mt-3 border-t border-ink-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <Paperclip className="h-3.5 w-3.5" /> Fayllar
          </span>
          <button type="button" className="btn-ghost text-xs" onClick={addFile}>
            <Plus className="h-3.5 w-3.5" /> Havola qo'shish
          </button>
        </div>
        {files.length === 0 ? (
          <div className="text-xs text-ink-400">Bu mahsulot uchun fayl biriktirilmagan</div>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-2.5">
                <div className="col-span-12 md:col-span-3">
                  <input
                    className="input"
                    placeholder="Fayl nomi"
                    value={f.filename}
                    onChange={(e) => updateFile(i, { filename: e.target.value })}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <select
                    className="input"
                    value={f.link_type}
                    onChange={(e) => updateFile(i, { link_type: e.target.value })}
                  >
                    {FILE_LINK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-12 md:col-span-4">
                  <input
                    className="input"
                    placeholder="https://..."
                    value={f.url}
                    onChange={(e) => updateFile(i, { url: e.target.value })}
                  />
                </div>
                <div className="col-span-9 md:col-span-2">
                  <input
                    className="input"
                    placeholder="Izoh"
                    value={f.note}
                    onChange={(e) => updateFile(i, { note: e.target.value })}
                  />
                </div>
                <div className="col-span-3 md:col-span-1 flex items-center justify-end gap-1">
                  {f.url && (
                    <a className="btn-ghost" href={f.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button type="button" className="btn-ghost text-rose-600 hover:bg-rose-50" onClick={() => removeFile(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
