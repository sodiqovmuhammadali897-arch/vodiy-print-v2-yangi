import { Link } from "react-router-dom";
import { Settings2, Stamp } from "lucide-react";
import type { WizardProduct } from "../../../lib/orderService";
import { souvenirPrice, type GiftboxPrices, type LineSouvenir } from "../../../lib/giftbox";
import { formatMoney } from "../../../lib/format";
import { useAuth } from "../../../lib/AuthContext";
import { canGiftbox } from "../../../lib/rolePermissions";

// A «Suvenir» order line priced from the owner's table (lib/giftbox.ts):
// the manager picks the item and whether it gets the logo; the price for
// this quantity comes out — no cost or markup shown. «Boshqa» leaves the
// line as before (catalog or a typed price).
type Props = {
  product: WizardProduct;
  prices: GiftboxPrices | null;
  onApply: (patch: Partial<WizardProduct>) => void;
};

export function souvenirPatch(prices: GiftboxPrices | null, sv: LineSouvenir | null, qty: number): Partial<WizardProduct> {
  if (!sv) return { souvenir: null, price_manual: false };
  const price = souvenirPrice(prices, qty || 1, sv);
  return {
    souvenir: sv,
    product_name: sv.name,
    variant: sv.logo ? "logo bilan" : "logosiz",
    catalog_product_id: null,
    ...(price !== null ? { unit_price: price } : {}),
    price_manual: false,
  };
}

export default function SouvenirPicker({ product, prices, onApply }: Props) {
  const owner = canGiftbox(useAuth(), "view");
  const sv = product.souvenir || null;
  const qty = Number(product.quantity || 0);
  const names = prices?.names || [];
  const price = sv ? souvenirPrice(prices, qty || 1, sv) : null;
  const set = (next: LineSouvenir | null) => onApply(souvenirPatch(prices, next, qty));

  return (
    <div className="col-span-12 rounded-xl border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-900/50 dark:bg-teal-900/10">
      <div className="flex items-center gap-2">
        <Stamp className="h-4 w-4 text-teal-700" />
        <span className="text-sm font-semibold text-ink-900">Suvenir — narx o'zi chiqadi</span>
        {owner && (
          <Link to="/giftbox" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline dark:text-amber-300">
            <Settings2 className="h-3.5 w-3.5" /> Tannarx va ustama (faqat sizga)
          </Link>
        )}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="label">Narsa</label>
          <select className="input" value={sv?.name || ""} onChange={(e) => set(e.target.value ? { name: e.target.value, logo: sv?.logo ?? true } : null)}>
            <option value="">— boshqa (katalogdan yoki qo'lda) —</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {sv && (
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={sv.logo} onChange={(e) => set({ ...sv, logo: e.target.checked })} />
            Logo bilan
          </label>
        )}
      </div>
      {sv && (
        <div className="mt-2 text-sm">
          {price !== null ? (
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
          ) : (
            <span className="font-semibold text-amber-700">Narx hali sozlanmagan — rahbar tannarx va suvenir ustamasini kiritsin.</span>
          )}
        </div>
      )}
    </div>
  );
}
