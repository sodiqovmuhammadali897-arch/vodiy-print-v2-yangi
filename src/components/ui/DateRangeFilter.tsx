import { presetRange, type DateRange, type DateRangePreset } from "../../lib/dateRange";

type Props = {
  value: DateRange;
  onChange: (range: DateRange) => void;
};

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "week", label: "Bu hafta" },
  { key: "month", label: "Bu oy" },
  { key: "year", label: "Bu yil" },
  { key: "custom", label: "Maxsus" },
];

export default function DateRangeFilter({ value, onChange }: Props) {
  const setPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ ...value, preset });
      return;
    }
    onChange({ preset, ...presetRange(preset) });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              value.preset === p.key
                ? "bg-brand-600 text-white"
                : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-auto"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="text-ink-400">—</span>
          <input
            type="date"
            className="input w-auto"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
