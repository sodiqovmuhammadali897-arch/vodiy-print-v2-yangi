import { useEffect, useState } from "react";
import { RotateCcw, Save, Users } from "lucide-react";
import { deleteOne, listAll, upsertOne } from "../../lib/firestoreDb";
import type { PersonalSchedule, WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { listPersonalSchedules } from "../../services/attendanceService";
import { offDaysOf, WEEKDAY_SHORT } from "../../utils/attendanceCalculations";

// Monday first, as people read a week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Draft = { workStart: string; workEnd: string; offDays: number[] };

// Each employee's own hours and days off. Without one, the general
// schedule above applies to them.
export default function PersonalSchedulesPanel({ general }: { general: WorkSchedule }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [own, setOwn] = useState<Map<string, PersonalSchedule>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [rows, map] = await Promise.all([listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }), listPersonalSchedules()]);
    setStaff(rows);
    setOwn(map);
  };

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, []);

  const current = (email: string): Draft => {
    const d = drafts[email];
    if (d) return d;
    const p = own.get(email);
    return p
      ? { workStart: p.workStart, workEnd: p.workEnd, offDays: p.offDays }
      : { workStart: general.workStart, workEnd: general.workEnd, offDays: offDaysOf(general) };
  };
  const patch = (email: string, p: Partial<Draft>) => {
    setSaved(null);
    setDrafts((all) => ({ ...all, [email]: { ...current(email), ...p } }));
  };
  const toggleDay = (email: string, day: number) => {
    const days = current(email).offDays;
    patch(email, { offDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() });
  };

  const save = async (s: Staff) => {
    const email = s.email.toLowerCase();
    const d = current(email);
    if (!d.workStart || !d.workEnd || d.workEnd <= d.workStart) return setError(`${s.full_name || email}: tugash vaqti boshlanishidan keyin bo'lishi kerak`);
    setError(null);
    setSaving(email);
    try {
      await upsertOne<PersonalSchedule>("work_schedules", email, {
        id: email,
        employee_email: email,
        employee_name: s.full_name || email,
        workStart: d.workStart,
        workEnd: d.workEnd,
        offDays: d.offDays,
        updatedAt: new Date().toISOString(),
      });
      setDrafts(({ [email]: _, ...rest }) => rest);
      await load();
      setSaved(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(null);
    }
  };

  const reset = async (email: string) => {
    setSaving(email);
    try {
      await deleteOne("work_schedules", email);
      setDrafts(({ [email]: _, ...rest }) => rest);
      await load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-bold text-ink-900">Xodimlar ish vaqti</h2>
      </div>
      <p className="mb-3 text-xs text-ink-500">
        Har bir xodimga o'z vaqti va dam olish kunlari. Kechikish, eslatma va KPI shunga qarab hisoblanadi. Alohida vaqt berilmaganlar umumiy vaqtda
        ishlaydi. Dam olish kunini bosib belgilang.
      </p>
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="divide-y divide-ink-100">
        {staff.map((s) => {
          const email = s.email.toLowerCase();
          const d = current(email);
          const isOwn = own.has(email);
          const dirty = Boolean(drafts[email]);
          return (
            <div key={email} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-[160px] flex-1">
                <div className="text-sm font-semibold text-ink-900">{s.full_name || email}</div>
                <div className={`text-[11px] ${isOwn ? "font-semibold text-brand-600" : "text-ink-400"}`}>{isOwn ? "Alohida vaqt" : "Umumiy vaqt"}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="time" className="input w-[110px] py-1.5" value={d.workStart} onChange={(e) => patch(email, { workStart: e.target.value })} aria-label="Boshlanishi" />
                <span className="text-ink-400">–</span>
                <input type="time" className="input w-[110px] py-1.5" value={d.workEnd} onChange={(e) => patch(email, { workEnd: e.target.value })} aria-label="Tugashi" />
              </div>
              <div className="flex gap-1" role="group" aria-label="Dam olish kunlari">
                {WEEK_ORDER.map((day) => {
                  const off = d.offDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(email, day)}
                      aria-pressed={off}
                      title={off ? "Dam olish kuni" : "Ish kuni"}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition ${off ? "bg-rose-100 text-rose-700" : "bg-ink-50 text-ink-600 hover:bg-ink-100"}`}
                    >
                      {WEEKDAY_SHORT[day]}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-primary px-3 py-1.5 text-xs" disabled={!dirty || saving === email} onClick={() => save(s)}>
                  <Save className="h-3.5 w-3.5" /> {saving === email ? "..." : "Saqlash"}
                </button>
                {isOwn && (
                  <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={saving === email} onClick={() => reset(email)} title="Umumiy vaqtga qaytarish">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                {saved === email && !dirty && <span className="text-xs font-semibold text-emerald-600">Saqlandi</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
