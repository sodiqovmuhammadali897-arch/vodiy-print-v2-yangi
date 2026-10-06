import { useEffect, useState } from "react";
import type { AttendanceRecord, WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { KIND_COLOR } from "./AttendanceAnalytics";

// Jamoa holati: today on one time axis — when each person came (the late
// part in amber), the lunch break, and a "now" line. Their own working
// hours are the dashed frame behind each bar.

type Row = { staff: Staff; record: AttendanceRecord | null; schedule: WorkSchedule };

// "09:30" → 570; nothing (no check-out yet) stays null, not midnight.
const toMin = (hm: string | null | undefined): number | null => {
  if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const nowMinute = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return (Number(p.find((x) => x.type === "hour")?.value || 0) % 24) * 60 + Number(p.find((x) => x.type === "minute")?.value || 0);
};
const label = (m: number) => `${Math.floor(m / 60)}:00`;

export default function TodayTimeline({ rows }: { rows: Row[] }) {
  const [now, setNow] = useState(nowMinute());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinute()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!rows.length) return null;

  const starts = rows.map((r) => toMin(r.schedule.workStart) ?? 540);
  const ends = rows.map((r) => toMin(r.schedule.workEnd) ?? 1080);
  const ins = rows.map((r) => toMin(r.record?.checkInTime)).filter((m): m is number => m !== null);
  const from = Math.floor((Math.min(...starts, ...ins) - 60) / 60) * 60;
  const to = Math.ceil((Math.max(...ends, now) + 30) / 60) * 60;
  const pct = (m: number) => `${((Math.min(to, Math.max(from, m)) - from) / (to - from)) * 100}%`;
  const width = (a: number, b: number) => `${(Math.max(0, Math.min(to, b) - Math.max(from, a)) / (to - from)) * 100}%`;
  const hoursTicks: number[] = [];
  for (let m = from; m <= to; m += 60) hoursTicks.push(m);
  const nowIn = now >= from && now <= to;

  return (
    <section className="card p-5">
      <h2 className="font-display text-[15px] font-bold text-ink-900">Bugungi kun chizig'i</h2>
      <p className="mt-0.5 text-xs text-ink-500">Kim qachon keldi, kechikkan qismi, tanaffus va hozirgi holat</p>
      <div className="mb-3 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: KIND_COLOR.on_time }} />Ishda</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: KIND_COLOR.late }} />Kechikkan vaqt</span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: `repeating-linear-gradient(45deg, ${KIND_COLOR.on_time} 0 2px, #fff 2px 4px)` }} />
          Tanaffus
        </span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-ink-300" />Ketgan</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-dashed border-ink-300" />Ish vaqti</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-0.5 bg-brand-600" />Hozir</span>
      </div>
      <div className="overflow-x-auto">
        <div className="relative min-w-[640px]">
          {nowIn && (
            // 130px name column + 12px gap, then the time axis.
            <div
              className="pointer-events-none absolute bottom-5 top-0 z-10 w-0.5 bg-brand-600"
              style={{ left: `calc(142px + (100% - 142px) * ${(now - from) / (to - from)})` }}
            >
              <span className="absolute -top-0.5 left-1.5 whitespace-nowrap rounded bg-brand-600 px-1 text-[10px] font-bold text-white">
                {String(Math.floor(now / 60)).padStart(2, "0")}:{String(now % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          {rows.map(({ staff, record, schedule }) => {
            const start = toMin(schedule.workStart) ?? 540;
            const end = toMin(schedule.workEnd) ?? 1080;
            const came = toMin(record?.checkInTime);
            const left = toMin(record?.checkOutTime);
            const bs = toMin(schedule.breakStart);
            const be = toMin(schedule.breakEnd);
            const stop = left ?? now;
            const late = came !== null && (record?.lateMinutes || 0) > 0;
            return (
              <div key={staff.email} className="grid grid-cols-[130px_1fr] items-center gap-3 py-1.5">
                <span className="truncate text-[13px] font-semibold text-ink-900">{staff.full_name || staff.email}</span>
                <div className="relative h-6">
                  <div className="absolute inset-y-0 rounded-md border border-dashed border-ink-300" style={{ left: pct(start), width: width(start, end) }} />
                  {came === null ? (
                    <span className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] text-ink-400" style={{ left: pct(start) }}>
                      hali kelmagan
                    </span>
                  ) : (
                    <>
                      {late && <div className="absolute inset-y-1 rounded" style={{ left: pct(start), width: width(start, came), background: KIND_COLOR.late }} />}
                      <div
                        className="absolute inset-y-1 rounded"
                        style={{ left: pct(came), width: width(came, stop), background: left !== null ? "rgb(var(--ink-300))" : KIND_COLOR.on_time }}
                        title={`Keldi ${record?.checkInTime}${record?.checkOutTime ? `, ketdi ${record.checkOutTime}` : ""}`}
                      />
                      {bs !== null && be !== null && bs < stop && be > came && (
                        <div
                          className="absolute inset-y-1"
                          style={{
                            left: pct(Math.max(bs, came)),
                            width: width(Math.max(bs, came), Math.min(be, stop)),
                            background: "repeating-linear-gradient(45deg, rgba(255,255,255,.75) 0 2px, transparent 2px 5px)",
                          }}
                          title="Tanaffus"
                        />
                      )}
                      <span className="absolute top-1/2 -translate-y-1/2 pl-1.5 text-[11px] font-bold text-white" style={{ left: pct(came) }}>
                        {record?.checkInTime}
                      </span>
                      {left !== null && (
                        <span className="absolute top-1/2 -translate-y-1/2 pl-1.5 text-[11px] font-semibold text-ink-500" style={{ left: pct(left) }}>
                          {record?.checkOutTime}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="relative ml-[142px] h-5">
            {hoursTicks.map((m, i) => (
              <span
                key={m}
                className={`absolute text-[11px] tabular-nums text-ink-400 ${i === hoursTicks.length - 1 ? "-translate-x-full" : i === 0 ? "" : "-translate-x-1/2"}`}
                style={{ left: pct(m) }}
              >
                {label(m)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
