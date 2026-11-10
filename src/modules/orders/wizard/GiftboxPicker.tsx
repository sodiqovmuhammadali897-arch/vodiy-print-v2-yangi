import { Link } from "react-router-dom";
import { Gift, Settings2 } from "lucide-react";
import { useAuth } from "../../../lib/AuthContext";
import { canGiftbox } from "../../../lib/rolePermissions";
import type { WizardProduct } from "../../../lib/orderService";
import { itemsLabel, priceFor, type GiftboxItem, type GiftboxPrices, type LineGiftbox } from "../../../lib/giftbox";
import { formatMoney } from "../../../lib/format";

// A «Gift Box» order line: the manager types the box's name and its market
// price and ticks the items the logo goes on; the price for this quantity
// comes from the owner's table (lib/giftbox.ts) — no cost or markup shown.
type Props = {
  product: WizardProduct;
  prices: GiftboxPrices | null;
  onApply: (patch: Partial<WizardProduct>) => void;
};

const num = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The line fields for this box and quantity.
export function giftboxPatch(prices: GiftboxPrices | null, gb: LineGiftbox, qty: number): Partial<WizardProduct> {
  const box_cost = Number(gb.box_cost) || 0;
  const price = box_cost > 0 ? priceFor(prices, qty || 1, box_cost, gb.items) : null;
  return {
    giftbox: { name: gb.name || "", box_cost, items: gb.items },
    product_name: gb.name?.trim() || "Gift box",
    variant: itemsLabel(gb.items),
    ...(price !== null ? { unit_price: price } : {}),
    price_manual: false,
  };
}

export default function GiftboxPicker({ product, prices, onApply }: Props) {
  const owner = canGiftbox(useAuth(), "view");
  const gb: LineGiftbox = product.giftbox || { name: "", box_cost: 0, items: [] };
  const items = gb.items || [];
  const qty = Number(product.quantity || 0);
  const boxCost = Number(gb.box_cost) || 0;
  const price = boxCost > 0 ? priceFor(prices, qty || 1, boxCost, items) : null;
  // Items with a print price, plus any already on the line.
  const options = Array.from(new Set([...(prices?.names || []), ...items.map((i) => i.name)].map((n) => n.trim()).filter(Boolean)));
  const has = (n: string) => items.find((i) => same(i.name, n));
  const set = (patch: Partial<LineGiftbox>) => onApply(giftboxPatch(prices, { ...gb, items, ...patch }, qty));

  return (
    <div className="col-span-12 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-semibold text-ink-900">Gift box</span>
        {owner && (
          <Link to="/giftbox" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline dark:text-amber-300">
            <Settings2 className="h-3.5 w-3.5" /> Pechat narxlari va ustama (faqat sizga)
          </Link>
        )}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
        <div>
          <label className="label">Gift box nomi</label>
          <input className="input" placeholder="masalan: Qora koja to'plam" value={gb.name || ""} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Bozordagi narxi (1 dona)</label>
          <input className="input text-right font-semibold" inputMode="numeric" placeholder="170 000" value={boxCost ? boxCost.toLocaleString("ru-RU") : ""} onChange={(e) => set({ box_cost: num(e.target.value) })} />
        </div>
      </div>

      <div className="mt-2 text-xs font-semibold text-ink-600">Ichida logo uriladigan narsalar (1 box'da):</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((n) => {
          const it = has(n);
          return (
            <span key={n} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${it ? "border-violet-500 bg-surface text-ink-900" : "border-ink-200 text-ink-500"}`}>
              <button type="button" onClick={() => set({ items: it ? items.filter((x) => x !== it) : [...items, { name: n, qty: 1 }] })}>
                {it ? "☑" : "☐"} {n}
              </button>
              {it && (
                <input
                  className="w-10 rounded border border-ink-200 bg-surface px-1 text-center text-xs"
                  inputMode="numeric"
                  value={it.qty}
                  aria-label={`${n} soni`}
                  onChange={(e) => set({ items: items.map((x): GiftboxItem => (x === it ? { ...x, qty: Math.max(1, num(e.target.value) || 1) } : x)) })}
                />
              )}
            </span>
          );
        })}
        {!options.length && <span className="text-xs text-amber-700">Narsalar ro'yxati bo'sh — rahbar «Gift box narxi»da pechat narxlarini kiritsin.</span>}
      </div>

      <div className="mt-2 text-sm">
        {!prices?.rows?.length ? (
          <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar «Gift box narxi»da ustamani kiritsin.</span>
        ) : !boxCost ? (
          <span className="text-ink-500">Bozordagi narxini yozing — narx o'zi chiqadi.</span>
        ) : price !== null ? (
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
        ) : null}
      </div>
    </div>
  );
}
