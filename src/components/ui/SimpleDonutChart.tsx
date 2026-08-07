import { formatMoney } from "../../lib/format";

export type DonutSlice = { label: string; value: number; color: string };

type Props = {
  data: DonutSlice[];
  size?: number;
  // Money donuts (the default) format the center/legend as currency;
  // count donuts (e.g. "156 ta") show the raw number with a unit suffix.
  valueFormat?: "money" | "count";
  unit?: string;
};

export default function SimpleDonutChart({ data, size = 160, valueFormat = "money", unit = "ta" }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2;
  const stroke = size * 0.22;
  const r = radius - stroke / 2;
  const circumference = 2 * Math.PI * r;

  const fmt = (v: number) => (valueFormat === "money" ? formatMoney(v).replace(" so'm", "") : `${v} ${unit}`);

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-ink-400"
        style={{ height: size }}
      >
        Ma'lumot yo'q
      </div>
    );
  }

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * circumference;
            const dasharray = `${dash} ${circumference - dash}`;
            const el = (
              <circle
                key={i}
                cx={radius}
                cy={radius}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text
          x={radius}
          y={radius - size * 0.06}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink-400"
          style={{ fontSize: size * 0.07, fontWeight: 600 }}
        >
          Jami
        </text>
        <text
          x={radius}
          y={radius + size * 0.06}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-ink-800"
          style={{ fontSize: size * 0.11, fontWeight: 700 }}
        >
          {fmt(total)}
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-ink-600">{d.label}</span>
            <span className="font-semibold text-ink-800">
              {fmt(d.value)} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
