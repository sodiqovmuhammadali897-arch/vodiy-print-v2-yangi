import type { GiftboxItem } from "../../lib/giftbox";

// What goes inside a gift box, one item per row (the owner: «ketma-ketlikda
// ro'yxat kabi»): a tick and, when ticked, how many in one box.
type Props = { options: string[]; items: GiftboxItem[]; onChange: (items: GiftboxItem[]) => void };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const num = (v: string) => Number(String(v).replace(/\D/g, "")) || 0;

export default function ItemsList({ options, items, onChange }: Props) {
  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-surface">
      {options.map((n, i) => {
        const it = items.find((x) => same(x.name, n));
        return (
          <div key={n} className={`flex items-center gap-3 px-3 py-2 ${it ? "bg-violet-50/60 dark:bg-violet-900/10" : ""}`}>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-violet-600"
                checked={Boolean(it)}
                onChange={() => onChange(it ? items.filter((x) => x !== it) : [...items, { name: n, qty: 1 }])}
              />
              <span className="w-5 text-right text-xs text-ink-400">{i + 1}.</span>
              <span className={`truncate ${it ? "font-semibold text-ink-900" : "text-ink-600"}`}>{n}</span>
            </label>
            {it && (
              <label className="flex items-center gap-1.5 text-xs text-ink-500">
                soni
                <input
                  className="w-14 rounded-lg border border-ink-200 bg-surface px-2 py-1 text-center text-sm"
                  inputMode="numeric"
                  aria-label={`${n} soni`}
                  value={it.qty}
                  onChange={(e) => onChange(items.map((x) => (x === it ? { ...x, qty: Math.max(1, num(e.target.value) || 1) } : x)))}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
