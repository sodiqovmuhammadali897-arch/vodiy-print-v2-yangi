import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatMoney, formatMoneyShort } from "../../../lib/format";

// Small SVG charts for the Moliya dashboard: thin rounded columns from one
// baseline, hairline grid, a legend for two series, a tooltip on hover.
// Colors: one fixed hue per series (light/dark steps), text in ink tokens.

// The chart is drawn at the width it really has, so its text stays at
// true size on a phone and on a wide screen alike.
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)) || fallback);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

export const SERIES = {
  blue: { fill: "fill-[#2a78d6] dark:fill-[#3987e5]", bg: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  aqua: { fill: "fill-[#1baf7a] dark:fill-[#199e70]", bg: "bg-[#1baf7a] dark:bg-[#199e70]" },
  orange: { fill: "fill-[#eb6834] dark:fill-[#d95926]", bg: "bg-[#eb6834] dark:bg-[#d95926]" },
  violet: { fill: "fill-[#6250d6] dark:fill-[#9085e9]", bg: "bg-[#6250d6] dark:bg-[#9085e9]" },
  gray: { fill: "fill-ink-300", bg: "bg-ink-300" },
} as const;
export type SeriesColor = keyof typeof SERIES;

// Axis and label money: «12,5 mln», «150 mln», «1,2 mlrd».
const one = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
const mln = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${one(v / 1e9)} mlrd`;
  if (a >= 1e6) return `${a >= 100e6 ? Math.round(v / 1e6) : one(v / 1e6)} mln`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} ming`;
  return String(Math.round(v));
};
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

// ↑↓ chip: change against the period before. `goodWhenUp` false for costs.
export function Delta({ value, goodWhenUp = true, suffix = "" }: { value: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value))
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">
        <Minus className="h-3 w-3" /> yangi
      </span>
    );
  const up = value >= 0;
  const flat = Math.abs(value) < 0.5;
  const good = flat ? null : up === goodWhenUp;
  const cls = good === null ? "bg-ink-100 text-ink-600" : good ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${cls}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value) >= 1000 ? "1000+" : Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0).replace(".", ",")}%{suffix}
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: SeriesColor }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <i className={`inline-block h-2.5 w-2.5 rounded-sm ${SERIES[i.color].bg}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// Grouped columns, one group per label (month), one or two series.
export type ColumnSeries = { label: string; color: SeriesColor; values: (number | null)[] };
export function ColumnChart({ labels, series, height = 220, note }: { labels: string[]; series: ColumnSeries[]; height?: number; note?: (i: number) => ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(640);
  const padL = 52;
  const padB = 26;
  const padT = 10;
  const plotH = height - padB - padT;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.max(0, v ?? 0)))));
  const band = (W - padL) / Math.max(1, labels.length);
  const barW = Math.min(24, (band * 0.7) / series.length);
  const gap = 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v: number) => padT + plotH - (Math.max(0, v) / max) * plotH;
  // A column with a 4px rounded top and a square foot on the baseline.
  const bar = (x: number, v: number) => {
    const top = y(v);
    const base = padT + plotH;
    const r = Math.min(4, base - top, barW / 2);
    if (base - top <= 0) return "";
    return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${base} Z`;
  };
  return (
    <div ref={box} className="relative">
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="block max-w-full" role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-ink-200" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-500 text-[11px]">
              {mln(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          const gx = padL + i * band + (band - (barW + gap) * series.length + gap) / 2;
          return (
            <g key={l} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * band} y={padT} width={band} height={plotH + padB} className={hover === i ? "fill-ink-100" : "fill-transparent"} />
              {series.map((s, si) => {
                const v = s.values[i];
                return v !== null && v > 0 ? <path key={s.label} d={bar(gx + si * (barW + gap), v)} className={SERIES[s.color].fill} /> : null;
              })}
              <text x={padL + i * band + band / 2} y={height - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? "fill-ink-900 font-semibold" : "fill-ink-500"}`}>
                {l}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(70, Math.max(2, ((padL + hover * band + band) / W) * 100))}%` }}
        >
          <div className="mb-1 font-semibold text-ink-900">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-ink-600">
                <i className={`inline-block h-2 w-2 rounded-sm ${SERIES[s.color].bg}`} />
                {s.label}
              </span>
              <b className="tabular-nums text-ink-900">{s.values[hover] === null ? "—" : formatMoneyShort(s.values[hover])}</b>
            </div>
          ))}
          {note && note(hover)}
        </div>
      )}
    </div>
  );
}

// Revenue → minus cost → minus expenses → net: floating steps.
export type Step = { label: string; value: number; kind: "start" | "minus" | "result" };
export function Waterfall({ steps, height = 220 }: { steps: Step[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(420);
  const padB = 40;
  const padT = 18;
  const plotH = height - padB - padT;
  let level = 0;
  const geo = steps.map((s) => {
    if (s.kind === "start") {
      level = s.value;
      return { s, a: 0, b: s.value };
    }
    if (s.kind === "minus") {
      const g = { s, a: level - s.value, b: level };
      level -= s.value;
      return g;
    }
    return { s, a: Math.min(0, s.value), b: Math.max(0, s.value) };
  });
  const top = niceMax(Math.max(1, ...geo.map((g) => g.b)));
  const low = Math.min(0, ...geo.map((g) => g.a));
  const span = top - low || 1;
  const y = (v: number) => padT + ((top - v) / span) * plotH;
  const band = W / steps.length;
  const bw = Math.min(56, band * 0.55);
  return (
    <div ref={box}>
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="block max-w-full" role="img" onMouseLeave={() => setHover(null)}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-ink-300" strokeWidth={1} />
      {geo.map((g, i) => {
        const x = i * band + (band - bw) / 2;
        const color = g.s.kind === "start" ? SERIES.blue.fill : g.s.kind === "minus" ? SERIES.orange.fill : g.s.value >= 0 ? SERIES.aqua.fill : "fill-rose-600";
        const h = Math.max(2, y(g.a) - y(g.b));
        return (
          <g key={g.s.label} onMouseEnter={() => setHover(i)}>
            {i > 0 && g.s.kind !== "result" && (
              // From where the previous step ended to this one.
              <line x1={x - (band - bw)} x2={x} y1={y(geo[i - 1].s.kind === "minus" ? geo[i - 1].a : geo[i - 1].b)} y2={y(geo[i - 1].s.kind === "minus" ? geo[i - 1].a : geo[i - 1].b)} className="stroke-ink-300" strokeWidth={1} />
            )}
            <rect x={x} y={y(g.b)} width={bw} height={h} rx={4} className={color} opacity={hover === null || hover === i ? 1 : 0.55} />
            <text x={x + bw / 2} y={y(g.b) - 5} textAnchor="middle" className="fill-ink-900 text-[11px] font-semibold">
              {g.s.kind === "minus" && g.s.value > 0 ? "−" : ""}
              {mln(g.s.value)}
            </text>
            <text x={i * band + band / 2} y={height - 22} textAnchor="middle" className="fill-ink-600 text-[11px]">
              {g.s.label}
            </text>
            {hover === i && (
              <text x={i * band + band / 2} y={height - 8} textAnchor="middle" className="fill-ink-500 text-[10px]">
                {formatMoney(g.s.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

// Horizontal bars with the label on the left and the value at the tip.
export function HBars({ rows, colorOf }: { rows: { label: ReactNode; value: number; sub?: ReactNode; key: string }[]; colorOf: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate text-ink-700">{r.label}</span>
          <div className="h-3 rounded-full bg-ink-100">
            <div className={`h-full rounded-full ${colorOf(r.key)}`} style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 4 : 0 }} />
          </div>
          <span className="whitespace-nowrap text-right tabular-nums">
            <b className="text-ink-900">{formatMoneyShort(r.value)}</b>
            {r.sub && <span className="ml-1 text-xs text-ink-500">{r.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
