import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Image as ImageIcon, Printer, Share2, X } from "lucide-react";
import type { CompanySettings, Product } from "../../lib/types";
import { getOne } from "../../lib/firestoreDb";
import { exportNodeToPdf } from "../../lib/exportPdf";
import { exportNodeToPng } from "../../lib/exportPng";
import { printProductPrice, shareProductPrice } from "./productExport";
import { quoteForQuantity } from "../../lib/priceCalculations";
import ProductCustomerPrice from "./ProductCustomerPrice";

type Props = {
  product: Product;
  onClose: () => void;
};

export default function ProductCustomerView({ product, onClose }: Props) {
  const docRef = useRef<HTMLDivElement>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [quantity, setQuantity] = useState<number>(product.min_order_qty || 0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getOne<CompanySettings>("company_settings", "main").then(setCompany);
  }, []);

  useEffect(() => {
    setQuantity(product.min_order_qty || product.price_tiers?.[0]?.min_qty || 0);
  }, [product.id, product.min_order_qty, product.price_tiers]);

  const quote = useMemo(
    () => (quantity > 0 ? quoteForQuantity(product.price_tiers || [], null, quantity) : null),
    [product.price_tiers, quantity],
  );

  const fileBase = `narx-${product.name}`.replace(/\s+/g, "-");
  const summary = `${company?.name || "Vodiy Print"} — ${product.name} narx taklifi`;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="chip bg-brand-600 text-white">Mijozga ko'rsatish rejimi</span>
          <div>
            <label className="sr-only">Tiraj</label>
            <input
              type="number"
              className="input w-28 !py-1.5"
              placeholder="Tiraj"
              value={quantity || ""}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("png", () => exportNodeToPng(docRef.current!, fileBase))}
          >
            <ImageIcon className="h-4 w-4" /> PNG
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("pdf", () => exportNodeToPdf(docRef.current!, fileBase))}
          >
            <FileDown className="h-4 w-4" /> PDF
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("print", () => printProductPrice(docRef.current!))}
          >
            <Printer className="h-4 w-4" /> Chop etish
          </button>
          <button
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => run("share", () => shareProductPrice(docRef.current!, fileBase, summary))}
          >
            <Share2 className="h-4 w-4" /> Ulashish
          </button>
          <button className="btn-ghost" onClick={onClose}>
            <X className="h-4 w-4" /> Yopish
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-ink-100/50 p-6">
        <ProductCustomerPrice ref={docRef} product={product} company={company} quantity={quantity} quote={quote} />
      </div>
    </div>
  );
}
