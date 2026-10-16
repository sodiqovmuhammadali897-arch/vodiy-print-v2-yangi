import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, Share2, X } from "lucide-react";
import type { Product } from "../../lib/types";
import { LESSONS } from "../darslik/lessonsData";
import { productsOf } from "../darslik/lessonFacts";

const CLOSE_DRAG_PX = 110;

// The customer price list of a product as plain text, for Telegram.
export const priceText = (p: Pick<Product, "name" | "unit" | "base_price" | "price_tiers" | "min_order_qty" | "lead_time_days">): string => {
  const so = (n: number) => `${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")} so'm`;
  const unit = p.unit || "dona";
  const tiers = (p.price_tiers || []).filter((t) => t.price > 0).sort((a, b) => a.min_qty - b.min_qty);
  const lines = [`${p.name}`];
  if (tiers.length) for (const t of tiers) lines.push(`${t.min_qty}+ ${unit} — ${so(t.price)}`);
  else if (p.base_price) lines.push(`Narx: ${so(p.base_price)} / ${unit}`);
  if (p.min_order_qty) lines.push(`Minimal buyurtma: ${p.min_order_qty} ${unit}`);
  if (p.lead_time_days) lines.push(`Tayyor bo'lishi: ${p.lead_time_days} kun`);
  lines.push("", "Vodiy Print · +998 77 200 88 55");
  return lines.join("\n");
};

// The Darslik lesson covering this product, if any.
export const lessonFor = (p: Pick<Product, "id" | "name">) => LESSONS.find((l) => productsOf(l, [{ id: p.id, name: p.name }]).length > 0) || null;

type Props = {
  product: Product;
  onClose: () => void;
  canShowLesson: boolean;
  onCustomerView?: () => void;
  customerView?: boolean;
  children: ReactNode;
};

// Phones: a product's details slide up over the list (bottom sheet).
// Closes by dragging the handle down, tapping outside, × or the phone's
// back button (ProductsPage pushes a history entry for it).
export default function ProductSheet({ product, onClose, canShowLesson, onCustomerView, customerView, children }: Props) {
  const [dy, setDy] = useState(0);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const start = useRef<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const lesson = canShowLesson ? lessonFor(product) : null;

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [product.id]);

  const onStart = (y: number) => {
    // Drag only from the top, or when the content is scrolled to its top.
    if ((body.current?.scrollTop || 0) > 0) return;
    start.current = y;
  };
  const onMove = (y: number) => {
    if (start.current === null) return;
    setDy(Math.max(0, y - start.current));
  };
  const onEnd = () => {
    if (start.current === null) return;
    start.current = null;
    if (dy > CLOSE_DRAG_PX) onClose();
    else setDy(0);
  };

  const share = async () => {
    const text = priceText(product);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // closed the share menu
    }
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className={`absolute inset-0 bg-ink-900/45 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 flex h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-ink-50 shadow-2xl"
        style={{
          transform: `translateY(${shown ? dy : 800}px)`,
          transition: start.current === null ? "transform 220ms cubic-bezier(.2,.8,.2,1)" : "none",
        }}
        onTouchStart={(e) => onStart(e.touches[0].clientY)}
        onTouchMove={(e) => onMove(e.touches[0].clientY)}
        onTouchEnd={onEnd}
      >
        <div className="relative shrink-0 bg-ink-50 pb-3 pt-2">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-ink-300" />
          <button onClick={onClose} aria-label="Yopish" className="absolute right-3 top-2 rounded-full p-1.5 text-ink-500 hover:bg-ink-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={body} className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          {children}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-ink-200 bg-surface px-3 pb-5 pt-2.5">
          {lesson && (
            <Link to={`/darslik/${lesson.key}`} className="btn-secondary flex-1 justify-center !px-2 text-xs">
              <BookOpen className="h-4 w-4" /> Darslik
            </Link>
          )}
          {onCustomerView && (
            <button className={`btn-secondary flex-1 justify-center !px-2 text-xs ${customerView ? "!bg-brand-600 !text-white" : ""}`} onClick={onCustomerView}>
              <Eye className="h-4 w-4" /> Mijozga
            </button>
          )}
          <button className="btn-primary flex-[1.3] justify-center whitespace-nowrap !px-2 text-xs" onClick={() => void share()}>
            <Share2 className="h-4 w-4 shrink-0" /> {copied ? "Nusxalandi" : "Narxni ulashish"}
          </button>
        </div>
      </div>
    </div>
  );
}
