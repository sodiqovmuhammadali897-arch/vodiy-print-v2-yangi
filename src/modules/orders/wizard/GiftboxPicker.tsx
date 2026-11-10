import { Gift } from "lucide-react";
import type { WizardProduct } from "../../../lib/orderService";
import { itemsLabel, priceFor, printableItems, type GiftboxItem, type GiftboxType } from "../../../lib/giftbox";
import { formatMoney } from "../../../lib/format";

// A «Gift Box» order line: the manager picks the gift box type and the
// items the logo goes on; the price for this quantity comes from the
// owner's table (lib/giftbox.ts) — no cost or markup is shown here.
type Props = {
  product: WizardProduct;
  types: GiftboxType[];
  onApply: (patch: Partial<WizardProduct>) => void;
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The line fields for a type, items and quantity.
export function giftboxPatch(type: GiftboxType, items: GiftboxItem[], qty: number, prevName = ""): Partial<WizardProduct> {
  const price = priceFor(type, qty, items);
  return {
    giftbox: { type_id: type.id, items },
    product_name: !prevName.trim() || prevName.startsWith("Gift box") || prevName === type.name ? type.name : prevName,
    variant: itemsLabel(items),
    ...(price !== null ? { unit_price: price } : {}),
    price_manual: false,
  };
}

export default function GiftboxPicker({ product, types, onApply }: Props) {
  const active = types.filter((t) => t.active !== false);
  const type = product.giftbox ? types.find((t) => t.id === product.giftbox!.type_id) || null : null;
  const items = product.giftbox?.items || [];
  const qty = Number(product.quantity || 0);
  const price = type ? priceFor(type, qty || 1, items) : null;
  const options = type ? Array.from(new Set([...type.items.map((i) => i.name), ...printableItems(type).map(cap)].map((n) => n.trim()).filter(Boolean))) : [];
  const has = (n: string) => items.find((i) => i.name.trim().toLowerCase() === n.trim().toLowerCase());
  const setItems = (next: GiftboxItem[]) => type && onApply(giftboxPatch(type, next, qty, product.product_name));

  return (
    <div className="col-span-12 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
      <div className="flex flex-wrap items-center gap-2">
        <Gift className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-semibold text-ink-900">Gift box</span>
        <select
          className="input w-auto min-w-[200px] py-1.5"
          value={type?.id || ""}
          onChange={(e) => {
            const t = active.find((x) => x.id === e.target.value);
            if (t) onApply(giftboxPatch(t, t.items.map((i) => ({ ...i })), qty, product.product_name));
          }}
        >
          <option value="">— turini tanlang —</option>
          {active.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!active.length && <span className="text-xs text-amber-700">Gift box turlari hali kiritilmagan — rahbar «Gift box narxi» sahifasida qo'shadi.</span>}
      </div>

      {type && (
        <>
          <div className="mt-2 text-xs font-semibold text-ink-600">Ichida logo uriladigan narsalar (1 box'da):</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {options.map((n) => {
              const it = has(n);
              return (
                <span key={n} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${it ? "border-violet-500 bg-surface text-ink-900" : "border-ink-200 text-ink-500"}`}>
                  <button type="button" onClick={() => setItems(it ? items.filter((x) => x !== it) : [...items, { name: n, qty: 1 }])}>
                    {it ? "☑" : "☐"} {n}
                  </button>
                  {it && (
                    <input
                      className="w-10 rounded border border-ink-200 bg-surface px-1 text-center text-xs"
                      inputMode="numeric"
                      value={it.qty}
                      aria-label={`${n} soni`}
                      onChange={(e) => setItems(items.map((x) => (x === it ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
                    />
                  )}
                </span>
              );
            })}
          </div>
          <div className="mt-2 text-sm">
            {price === null ? (
              <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar ustamani kiritsin.</span>
            ) : (
              <span className="text-ink-700">
                Narx: <b className="text-ink-900">{formatMoney(price)}</b> / dona
                {qty > 0 && (
                  <>
                    {" "}
                    · {qty} dona jami <b className="text-ink-900">{formatMoney(price * qty)}</b>
                  </>
                )}
                <span className="ml-1 text-xs text-ink-500">(soni o'zgarsa narx o'zi qayta chiqadi)</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
