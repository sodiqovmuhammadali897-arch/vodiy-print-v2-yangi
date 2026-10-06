import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { getOne, listAll, listRange } from "../../lib/firestoreDb";
import { DEFAULT_KPI_WEIGHTS, type AttendanceRecord, type Holiday, type KpiSettings, type LeaveRequest, type PersonalSchedule, type WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { getWorkSchedule, listPersonalSchedules } from "../../services/attendanceService";
import { defaultDateRange, previousPeriod, type DateRange } from "../../lib/dateRange";
import { buildAnalytics, hm, offsetLabel, type Analytics, type DayKind, type StaffSummary } from "../../lib/attendanceAnalytics";
import { dateCodeOf } from "../../utils/attendanceCalculations";
import { exportCsv } from "../../lib/exportCsv";
import DateRangeFilter from "../../components/ui/DateRangeFilter";

// Davomat → Tahlil: charts and a report over a period, drawn from the
// attendance records (lib/attendanceAnalytics.ts does the counting).

// Status colours: fixed meaning, always shown with a label in the legend.
export const KIND_COLOR: Record<DayKind, string> = {
  on_time: "#0ca30c",
  late: "#fab219",
  early: "#ec835a",
  absent: "#d03b3b",
  leave: "#7c8db5",
  off: "rgb(var(--ink-200))",
  pending: "rgb(var(--ink-100))",
};
const KIND_LABEL: Record<DayKind, string> = {
  on_time: "Vaqtida",
  late: "Kechikdi",
  early: "Erta ketdi",
  absent: "Kelmadi",
  leave: "Ta'til / ruxsat",
  off: "Dam olish",
  pending: "Hali kelmagan",
};
const BRAND = "#0062db";

const nowMinuteTashkent = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return (Number(p.find((x) => x.type === "hour")?.value || 0) % 24) * 60 + Number(p.find((x) => x.type === "minute")?.value || 0);
};
const dayNum = (code: string) => Number(code.slice(8, 10));
const dmy = (code: string) => `${code.slice(8, 10)}.${code.slice(5, 7)}`;
const hours = (min: number) => Math.round(min / 60);

// Width of a box, so SVG charts draw at real pixels (crisp text, no stretch).
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

export default function AttendanceAnalytics() {
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [person, setPerson] = useState("");
  const [base, setBase] = useState<{
    staff: Staff[];
    general: WorkSchedule;
    personal: Map<string, PersonalSchedule>;
    holidays: Holiday[];
    leaves: LeaveRequest[];
    weights: typeof DEFAULT_KPI_WEIGHTS;
  } | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [staff, general, personal, holidays, leaves, settings] = await Promise.all([
          listAll<Staff>("staff"),
          getWorkSchedule(),
          listPersonalSchedules().catch(() => new Map<string, PersonalSchedule>()),
          listAll<Holiday>("holidays").catch(() => [] as Holiday[]),
          listAll<LeaveRequest>("leave_requests").catch(() => [] as LeaveRequest[]),
          getOne<KpiSettings>("kpi_settings", "default").catch(() => null),
        ]);
        setBase({
          staff: staff.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)),
          general,
          personal,
          holidays,
          leaves,
          weights: settings?.weights || DEFAULT_KPI_WEIGHTS,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ma'lumotlarni yuklab bo'lmadi");
      }
    })();
  }, []);

  const prev = useMemo(() => previousPeriod(range), [range]);
  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    listRange<AttendanceRecord>("attendance", "dateCode", prev.from, range.to)
      .then((r) => !cancelled && setRecords(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Davomatni yuklab bo'lmadi"));
    return () => {
      cancelled = true;
    };
  }, [prev.from, range.to]);

  const [now, current, before] = useMemo(() => {
    if (!base || !records) return [null, null, null] as const;
    const today = dateCodeOf(new Date());
    const nowMinute = nowMinuteTashkent();
    const people = person ? base.staff.filter((s) => s.email.toLowerCase() === person) : base.staff;
    const build = (from: string, to: string) =>
      buildAnalytics({ from, to, today, nowMinute, staff: people, general: base.general, personal: base.personal, records, leaves: base.leaves, holidays: base.holidays, weights: base.weights });
    return [today, build(range.from, range.to), build(prev.from, prev.to)] as const;
  }, [base, records, person, range.from, range.to, prev.from, prev.to]);

  const exportReport = () => {
    if (!current) return;
    exportCsv(
      `davomat-${range.from}_${range.to}`,
      ["Xodim", "Kelgan kun", "Ish kuni", "Davomat %", "Kechikish (marta)", "Kechikish (daq)", "Erta ketish (marta)", "Kelmagan", "Ishlagan (soat)", "Norma (soat)", "Qo'shimcha (soat)", "O'rtacha kelish", "KPI %"],
      current.staff.map((s) => [
        s.name,
        s.present,
        s.workingDays,
        s.attendancePct ?? "",
        s.lateCount,
        s.lateMinutes,
        s.earlyCount,
        s.absent,
        hours(s.workedMinutes),
        hours(s.normMinutes),
        hours(s.overtimeMinutes),
        hm(s.avgArrivalMinute),
        s.kpiPct ?? "",
      ]),
    );
  };

  const showTip = (e: React.MouseEvent, title: string, lines: string[]) => setTip({ x: e.clientX, y: e.clientY, title, lines });
  const hideTip = () => setTip(null);

  return (
    <div className="space-y-4" onMouseLeave={hideTip}>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter value={range} onChange={setRange} />
        <select className="input w-auto" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Xodim">
          <option value="">Barcha xodimlar</option>
          {base?.staff.map((s) => (
            <option key={s.email} value={s.email.toLowerCase()}>
              {s.full_name || s.email}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary ml-auto" onClick={exportReport} disabled={!current}>
          <Download className="h-4 w-4" /> Excel
        </button>
      </div>

      {error && <div className="card p-4 text-sm font-semibold text-rose-600">{error}</div>}
      {!current || !before || !now ? (
        !error && (
          <div className="flex items-center justify-center py-20 text-ink-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )
      ) : current.totals.expected === 0 && current.totals.present === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-ink-500">
          <BarChart3 className="h-6 w-6 text-ink-400" />
          Bu davrda ish kuni yoki davomat yozuvi yo'q
        </div>
      ) : (
        <>
          <Tiles a={current} b={before} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title="Kunlik davomat" sub="Har bir ish kuni: nechta xodim vaqtida keldi, kechikdi, kelmadi" className="xl:col-span-2">
              <Legend kinds={["on_time", "late", "absent"]} />
              <DailyBars a={current} onTip={showTip} onLeave={hideTip} />
            </Card>
            <Card title="Kechikishlar reytingi" sub="Davr davomida jami kechikkan vaqt">
              <LateRanking a={current} />
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="O'rtacha kelish vaqti" sub="Har kuni, har kimning o'z ish boshlanishiga nisbatan; punktir — ish boshlanishi">
              <ArrivalLine a={current} onTip={showTip} onLeave={hideTip} />
            </Card>
            <Card title="Ishlangan soat va norma" sub="Tanaffussiz; qora belgi — davr normasi">
              <HoursVsNorm a={current} />
            </Card>
          </div>
          <Card title="Kalendar" sub="Har bir xodimning har kuni; katakdagi raqam — kechikkan daqiqa">
            <Legend kinds={["on_time", "late", "early", "absent", "leave", "off"]} />
            <Heatmap a={current} onTip={showTip} onLeave={hideTip} />
          </Card>
          <Card title="Xodimlar bo'yicha hisobot" sub="Excel tugmasi shu jadvalni yuklab beradi">
            <ReportTable a={current} />
          </Card>
        </>
      )}

      {tip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-xl border border-ink-200 bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 240), top: tip.y + 14 }}
          role="tooltip"
        >
          <div className="font-bold text-ink-900">{tip.title}</div>
          {tip.lines.map((l) => (
            <div key={l} className="text-ink-600">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ title, sub, children, className = "" }: { title: string; sub: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 ${className}`}>
      <h2 className="font-display text-[15px] font-bold text-ink-900">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-500">{sub}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Legend({ kinds }: { kinds: DayKind[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: KIND_COLOR[k] }} />
          {KIND_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

function Tiles({ a, b }: { a: Analytics; b: Analytics }) {
  const t = a.totals;
  const p = b.totals;
  // No comparison against a period the system was hardly used in (it
  // went live mid-period): a jump from almost nothing means nothing.
  const comparable = p.expected > 0 && p.present >= p.expected * 0.5;
  const delta = (cur: number | null, old: number | null, unit: string, goodWhenUp: boolean) => {
    if (!comparable || cur === null || old === null || (old === 0 && cur === 0)) return null;
    const d = Math.round(cur - old);
    if (d === 0) return { text: "o'tgan davr bilan bir xil", good: null };
    return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)}${unit} o'tgan davrga`, good: d > 0 === goodWhenUp };
  };
  const tiles: { label: string; value: ReactNode; hint: string; d: { text: string; good: boolean | null } | null }[] = [
    {
      label: "Davomat",
      value: t.attendancePct === null ? "—" : <>{t.attendancePct}<small>%</small></>,
      hint: `${t.present} / ${t.expected} kishi-kun`,
      d: delta(t.attendancePct, p.attendancePct, "%", true),
    },
    {
      label: "O'rtacha kelish",
      value: <span className="text-[22px]">{offsetLabel(t.avgArrivalOffset)}</span>,
      hint: "har kimning o'z ish boshlanishiga nisbatan",
      d: delta(t.avgArrivalOffset, p.avgArrivalOffset, " daq", false),
    },
    {
      label: "Kechikishlar",
      value: <>{t.lateCount} <small>marta</small></>,
      hint: `jami ${Math.floor(t.lateMinutes / 60)} soat ${t.lateMinutes % 60} daq`,
      d: delta(t.lateCount, p.lateCount, " marta", false),
    },
    {
      label: "Ishlangan soat",
      value: <>{hours(t.workedMinutes)} <small>/ {hours(t.normMinutes)}</small></>,
      hint: t.normMinutes ? `normaning ${Math.round((t.workedMinutes / t.normMinutes) * 100)}%` : "norma yo'q",
      d: delta(hours(t.workedMinutes), hours(p.workedMinutes), " soat", true),
    },
    {
      label: "Qo'shimcha ish",
      value: <>{hours(t.overtimeMinutes)} <small>soat</small></>,
      hint: t.overtimePeople ? `${t.overtimePeople} xodimda` : "qo'shimcha ishlanmagan",
      d: delta(hours(t.overtimeMinutes), hours(p.overtimeMinutes), " soat", true),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((x) => (
        <div key={x.label} className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{x.label}</div>
          <div className="mt-1 font-display text-[28px] font-extrabold tabular-nums text-ink-900 [&_small]:text-sm [&_small]:font-bold [&_small]:text-ink-400">{x.value}</div>
          <div className="text-xs text-ink-500">{x.hint}</div>
          {x.d && (
            <div className={`mt-1 text-xs font-bold ${x.d.good === null ? "text-ink-400" : x.d.good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {x.d.good === null ? "•" : x.d.good ? "▲" : "▼"} {x.d.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type TipFn = (e: React.MouseEvent, title: string, lines: string[]) => void;

// Labels on the x-axis: about eight of them, the last day always — and a
// regular one dropped when it would sit right next to the last.
const tickEvery = (n: number) => Math.max(1, Math.ceil(n / 8));
const showTick = (i: number, n: number) => {
  const step = tickEvery(n);
  return i === n - 1 || (i % step === 0 && n - 1 - i >= step / 2);
};

function DailyBars({ a, onTip, onLeave }: { a: Analytics; onTip: TipFn; onLeave: () => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 220, L = 26, B = 22, T = 6;
  const n = Math.max(1, a.staff.length);
  const plotH = H - T - B;
  // A short period keeps bars slim and centred instead of stretching them.
  const bw = W > L ? Math.min(44, (W - L) / a.daily.length) : 0;
  const x0 = L + Math.max(0, (W - L - bw * a.daily.length) / 2);
  const gap = Math.min(4, bw * 0.25);
  const yTicks = Array.from(new Set([0, Math.round(n / 2), n]));
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="Kunlik davomat diagrammasi">
          {yTicks.map((k) => {
            const y = T + plotH * (1 - k / n);
            return (
              <g key={k}>
                <line x1={L} x2={W} y1={y} y2={y} className="stroke-ink-100" />
                <text x={L - 8} y={y + 4} textAnchor="end" className="fill-ink-400 text-[11px]">
                  {k}
                </text>
              </g>
            );
          })}
          {a.daily.map((d, i) => {
            const x = x0 + i * bw + gap / 2;
            const w = Math.max(1, bw - gap);
            const segs: [number, string][] = [
              [d.onTime, KIND_COLOR.on_time],
              [d.late, KIND_COLOR.late],
              [d.absent, KIND_COLOR.absent],
            ];
            let acc = 0;
            return (
              <g
                key={d.date}
                onMouseMove={(e) => onTip(e, dmy(d.date), d.off ? ["Dam olish kuni"] : [`Vaqtida: ${d.onTime}`, `Kechikdi: ${d.late}`, `Kelmadi: ${d.absent}`])}
                onMouseLeave={onLeave}
              >
                <rect x={x0 + i * bw} y={T} width={bw} height={plotH} fill="transparent" />
                {d.off ? (
                  <rect x={x} y={T + plotH - 4} width={w} height={4} rx={2} fill={KIND_COLOR.off} />
                ) : (
                  segs.map(([v, c], j) => {
                    if (!v) return null;
                    const h = (plotH * v) / n;
                    const y = T + plotH - acc - h;
                    acc += h;
                    return <rect key={j} x={x} y={y} width={w} height={Math.max(1, h - 2)} rx={Math.min(3, w / 3)} fill={c} />;
                  })
                )}
                {showTick(i, a.daily.length) && (
                  <text x={x0 + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-ink-400 text-[11px]">
                    {dayNum(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function LateRanking({ a }: { a: Analytics }) {
  const rows = [...a.staff].sort((x, y) => y.lateMinutes - x.lateMinutes || y.lateCount - x.lateCount);
  const max = Math.max(1, ...rows.map((r) => r.lateMinutes));
  if (!rows.some((r) => r.lateCount)) return <div className="py-8 text-center text-sm text-ink-500">Bu davrda hech kim kechikmagan 👏</div>;
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.email}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate font-semibold text-ink-900">{r.name}</span>
            <span className="shrink-0 tabular-nums text-xs text-ink-600">
              {r.lateCount ? `${r.lateCount} marta · ${r.lateMinutes} daq` : "kechikmagan"}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full" style={{ width: `${r.lateMinutes ? Math.max(3, (r.lateMinutes / max) * 100) : 0}%`, background: KIND_COLOR.late }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ArrivalLine({ a, onTip, onLeave }: { a: Analytics; onTip: TipFn; onLeave: () => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 220, L = 58, B = 22, T = 14, R = 10;
  const pts = a.daily.map((d, i) => ({ i, d, v: d.avgOffset }));
  const vals = pts.filter((p) => p.v !== null).map((p) => p.v!);
  if (!vals.length) return <div className="py-8 text-center text-sm text-ink-500">Kelish yozuvlari yo'q</div>;
  const lo = Math.min(-15, Math.floor(Math.min(...vals) / 15) * 15);
  const hi = Math.max(15, Math.ceil(Math.max(...vals) / 15) * 15);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, a.daily.length - 1);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 15) ticks.push(v);
  // Days off break the line instead of dragging it to zero.
  const segments: { i: number; v: number }[][] = [];
  pts.forEach((p) => {
    if (p.v === null) segments.push([]);
    else (segments[segments.length - 1] || segments[segments.push([]) - 1]).push({ i: p.i, v: p.v });
  });
  const last = [...pts].reverse().find((p) => p.v !== null)!;
  const label = (v: number) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)} daq`);
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label="O'rtacha kelish vaqti diagrammasi" onMouseLeave={onLeave}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-ink-400" : "stroke-ink-100"} strokeDasharray={v === 0 ? "4 4" : undefined} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-400 text-[11px]">
                {label(v)}
              </text>
            </g>
          ))}
          <text x={L + 4} y={T - 3} className="fill-ink-400 text-[10px]">
            ↑ kech · ↓ erta
          </text>
          {segments
            .filter((s) => s.length)
            .map((s, k) => (
              <path
                key={k}
                d={s.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join("")}
                fill="none"
                stroke={BRAND}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          {pts.map((p) =>
            p.v === null ? null : (
              <g key={p.i} onMouseMove={(e) => onTip(e, dmy(p.d.date), [`O'rtacha: ${offsetLabel(p.v)}`, `Kechikkan: ${p.d.late} kishi`])}>
                <rect x={x(p.i) - 8} y={T} width={16} height={H - T - B} fill="transparent" />
                <circle cx={x(p.i)} cy={y(p.v)} r={p.i === last.i ? 4.5 : 2.5} fill={BRAND} className="stroke-surface" strokeWidth={p.i === last.i ? 2 : 0} />
              </g>
            ),
          )}
          <text x={x(last.i) - 8} y={y(last.v!) - 9} textAnchor="end" className="fill-ink-900 text-[11px] font-bold">
            {offsetLabel(last.v)}
          </text>
          {a.daily.map((d, i) =>
            showTick(i, a.daily.length) ? (
              <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-ink-400 text-[11px]">
                {dayNum(d.date)}
              </text>
            ) : null,
          )}
        </svg>
      )}
    </div>
  );
}

function HoursVsNorm({ a }: { a: Analytics }) {
  const max = Math.max(1, ...a.staff.map((s) => Math.max(s.workedMinutes, s.normMinutes))) * 1.08;
  return (
    <div className="space-y-4">
      {a.staff.map((s) => {
        const done = s.normMinutes ? s.workedMinutes >= s.normMinutes : false;
        return (
          <div key={s.email} className="grid grid-cols-[120px_1fr_64px] items-center gap-3 text-[13px]">
            <span className="truncate font-semibold text-ink-900">{s.name}</span>
            <div className="relative h-3.5 rounded-full bg-ink-100">
              <div className="h-full rounded-full" style={{ width: `${(s.workedMinutes / max) * 100}%`, background: done ? KIND_COLOR.on_time : BRAND }} />
              {s.normMinutes > 0 && (
                <div className="absolute -top-1 w-0.5 rounded bg-ink-900" style={{ left: `${(s.normMinutes / max) * 100}%`, height: 22 }} title={`Norma: ${hours(s.normMinutes)} soat`} />
              )}
            </div>
            <span className="text-right text-xs font-bold tabular-nums text-ink-700">
              {hours(s.workedMinutes)} / {hours(s.normMinutes)}
            </span>
          </div>
        );
      })}
      <div className="text-right text-[11px] text-ink-400">soat: ishlangan / norma</div>
    </div>
  );
}

function Heatmap({ a, onTip, onLeave }: { a: Analytics; onTip: TipFn; onLeave: () => void }) {
  const cell = a.days.length > 40 ? 14 : 30;
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-grid gap-y-1.5" style={{ gridTemplateColumns: `130px repeat(${a.days.length}, ${cell}px)`, columnGap: 3 }}>
        <div />
        {a.days.map((d, i) => (
          <div key={d} className="text-center text-[10px] tabular-nums text-ink-400">
            {a.days.length <= 40 || i % 7 === 0 ? dayNum(d) : ""}
          </div>
        ))}
        {a.staff.map((s) => (
          <Row key={s.email} s={s} days={a.days} cell={cell} onTip={onTip} onLeave={onLeave} />
        ))}
      </div>
    </div>
  );
}

function Row({ s, days, cell, onTip, onLeave }: { s: StaffSummary; days: string[]; cell: number; onTip: TipFn; onLeave: () => void }) {
  return (
    <>
      <div className="truncate pr-2 text-[13px] font-semibold leading-[30px] text-ink-900">{s.name}</div>
      {s.cells.map((c, i) => {
        const r = c.record;
        const lines = [KIND_LABEL[c.kind]];
        if (r?.checkInTime) lines.push(`Keldi ${r.checkInTime}${r.checkOutTime ? ` · ketdi ${r.checkOutTime}` : ""}`);
        if (c.lateMinutes) lines.push(`${c.lateMinutes} daq kechikdi`);
        if (c.earlyMinutes) lines.push(`${c.earlyMinutes} daq erta ketdi`);
        if (r?.authenticationMethod === "manual") lines.push("Qo'lda belgilangan");
        return (
          <div
            key={days[i]}
            className="flex items-center justify-center rounded-[5px] text-[10px] font-bold tabular-nums"
            style={{ height: 30, width: cell, background: KIND_COLOR[c.kind], color: c.kind === "late" ? "#3b2a00" : "#fff" }}
            onMouseMove={(e) => onTip(e, `${s.name} · ${dmy(days[i])}`, lines)}
            onMouseLeave={onLeave}
          >
            {cell >= 24 ? (c.kind === "late" ? c.lateMinutes : c.kind === "absent" ? "✕" : "") : ""}
          </div>
        );
      })}
    </>
  );
}

function ReportTable({ a }: { a: Analytics }) {
  const tone = (n: number | null) =>
    n === null ? "bg-ink-100 text-ink-600" : n >= 85 ? "bg-emerald-100 text-emerald-800" : n >= 70 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700";
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-ink-100">
            {["Xodim", "Kelgan kun", "Davomat", "Kechikish", "Erta ketish", "Ishlagan / norma", "Qo'shimcha", "O'rtacha kelish", "KPI"].map((h) => (
              <th key={h} className="table-th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {a.staff.map((s) => {
            const pct = s.normMinutes ? Math.min(100, (s.workedMinutes / s.normMinutes) * 100) : 0;
            return (
              <tr key={s.email}>
                <td className="table-td font-semibold text-ink-900">{s.name}</td>
                <td className="table-td">
                  {s.present} / {s.workingDays}
                </td>
                <td className="table-td">{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</td>
                <td className="table-td">
                  {s.lateCount ? <span className="chip bg-amber-100 text-amber-800">{s.lateCount} marta · {s.lateMinutes} daq</span> : "—"}
                </td>
                <td className="table-td">{s.earlyCount ? `${s.earlyCount} marta` : "—"}</td>
                <td className="table-td">
                  <span className="mr-2 inline-block h-2 w-24 overflow-hidden rounded-full bg-ink-100 align-middle">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? KIND_COLOR.on_time : BRAND }} />
                  </span>
                  {hours(s.workedMinutes)} / {hours(s.normMinutes)} soat
                </td>
                <td className="table-td">{s.overtimeMinutes ? `${hours(s.overtimeMinutes)} soat` : "—"}</td>
                <td className="table-td">
                  {hm(s.avgArrivalMinute)} <span className="text-xs text-ink-400">({s.schedule.workStart})</span>
                </td>
                <td className="table-td">
                  <span className={`chip font-bold ${tone(s.kpiPct)}`}>{s.kpiPct ?? "—"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
