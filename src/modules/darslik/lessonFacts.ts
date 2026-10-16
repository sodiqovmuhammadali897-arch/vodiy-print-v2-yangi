// The live numbers of a lesson — price range, smallest run, lead time — from
// the products in Mahsulotlar it covers, and the lesson text with the
// script's {narx}, {tiraj} and {muddat} filled in. Kept free of React so it
// can be tested.
import type { Lesson } from "./lessonsData";

export type FactProduct = {
  id: string;
  name: string;
  category?: string;
  base_price?: number;
  price_tiers?: { min_qty: number; price: number }[];
  min_order_qty?: number;
  lead_time_days?: number;
  is_active?: boolean;
  archived_at?: string | null;
};

export type LessonFacts = {
  products: FactProduct[];
  narx: string | null; // "2 900 – 6 500 so'm"
  tiraj: string | null; // "500"
  muddat: string | null; // "7–10 kun"
};

const words = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`]/g, "'");

export const productsOf = (lesson: Pick<Lesson, "match">, products: FactProduct[]): FactProduct[] =>
  products.filter((p) => !p.archived_at && p.is_active !== false && lesson.match.some((m) => words(p.name || "").includes(words(m))));

export const money = (n: number): string => `${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")} so'm`;

export const lessonFacts = (lesson: Pick<Lesson, "match">, all: FactProduct[]): LessonFacts => {
  const products = productsOf(lesson, all);
  const prices = products.flatMap((p) => [Number(p.base_price || 0), ...(p.price_tiers || []).map((t) => Number(t.price || 0))]).filter((n) => n > 0);
  const runs = products.map((p) => Number(p.min_order_qty || 0)).filter((n) => n > 0);
  const days = products.map((p) => Number(p.lead_time_days || 0)).filter((n) => n > 0);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return {
    products,
    narx: prices.length ? (lo === hi ? money(lo) : `${money(lo).replace(" so'm", "")} – ${money(hi)}`) : null,
    tiraj: runs.length ? String(Math.min(...runs)) : null,
    muddat: days.length ? (Math.min(...days) === Math.max(...days) ? `${days[0]} kun` : `${Math.min(...days)}–${Math.max(...days)} kun`) : null,
  };
};

export type Piece = { text: string; fact?: "narx" | "tiraj" | "muddat"; missing?: boolean };

// "{tiraj} donadan" → [{text:"500", fact:"tiraj"}, {text:" donadan"}]. A fact
// with no product data stays as a visible gap, so it is noticed and filled
// in Mahsulotlar rather than read out as nonsense.
export const fillScript = (text: string, facts: Pick<LessonFacts, "narx" | "tiraj" | "muddat">): Piece[] => {
  const out: Piece[] = [];
  const re = /\{(narx|tiraj|muddat)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const key = m[1] as "narx" | "tiraj" | "muddat";
    const value = facts[key];
    out.push(value ? { text: value, fact: key } : { text: key, fact: key, missing: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
};

// ── progress ────────────────────────────────────────────────────────
// lesson_progress/{email}.lessons[key]: which tabs were opened and the
// best test score. A lesson counts as read once its three core tabs were
// opened.
export type LessonProgress = { seen?: string[]; quiz?: number | null; quiz_at?: string; read_at?: string };
export const CORE_TABS = ["about", "script", "objections"];
export const isRead = (p: LessonProgress | undefined): boolean => Boolean(p && CORE_TABS.every((t) => (p.seen || []).includes(t)));
export const lessonState = (p: LessonProgress | undefined): "done" | "started" | "new" =>
  isRead(p) ? "done" : p && (p.seen || []).length ? "started" : "new";

// Test score in percent, rounded.
export const score = (answers: (number | null)[], correct: number[]): number =>
  correct.length ? Math.round((answers.filter((a, i) => a === correct[i]).length / correct.length) * 100) : 0;
