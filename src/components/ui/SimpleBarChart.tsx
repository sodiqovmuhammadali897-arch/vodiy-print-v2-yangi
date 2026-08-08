import { formatMoneyShort } from "../../lib/format";

export type BarPoint = { label: string; value: number };

type Props = {
  data: BarPoint[];
  height?: number;
  color?: string;
};

export default function SimpleBarChart({ data, height = 180, color = "#4f46e5" }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const showEveryNth = data.length > 20 ? Math.ceil(data.length / 20) : 1;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-ink-400"
        style={{ height }}
      >
        Ma'lumot yo'q
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="flex items-end gap-1"
        style={{ height, minWidth: data.length * 18 }}
      >
        {data.map((d, i) => {
          const barHeight = Math.max(2, (d.value / max) * (height - 24));
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ minWidth: 10 }}
            >
              <div className="pointer-events-none absolute -top-8 z-10 hidden rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                {d.label}: {formatMoneyShort(d.value)}
              </div>
              <div
                className="w-full rounded-t transition-opacity hover:opacity-80"
                style={{ height: barHeight, backgroundColor: color }}
              />
              {i % showEveryNth === 0 && (
                <div className="mt-1 whitespace-nowrap text-[9px] text-ink-400">
                  {d.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
