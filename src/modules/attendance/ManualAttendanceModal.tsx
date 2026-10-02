import { useEffect, useState } from "react";
import { getOne, insertOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import type { AttendanceRecord, WorkSchedule } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { buildManualRecord, manualEntryError } from "../../lib/manualAttendance";
import { formatMinutes } from "../../utils/attendanceCalculations";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  staff: Staff[];
  initialEmail: string;
  today: string;
  scheduleFor: (email: string) => WorkSchedule;
};

const dayBefore = (code: string) => new Date(Date.parse(`${code}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);

export default function ManualAttendanceModal({ open, onClose, staff, initialEmail, today, scheduleFor }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [dateCode, setDateCode] = useState(today);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [existing, setExisting] = useState<AttendanceRecord | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setDateCode(today);
    setError(null);
  }, [open, initialEmail, today]);

  // Prefill from what is already saved for that person and day.
  useEffect(() => {
    if (!open || !email || !dateCode) return;
    let cancelled = false;
    setLoadingDay(true);
    getOne<AttendanceRecord>("attendance", `${email}_${dateCode}`)
      .then((r) => {
        if (cancelled) return;
        setExisting(r);
        setCheckIn(r?.checkInTime || scheduleFor(email).workStart);
        setCheckOut(r?.checkOutTime || "");
      })
      .catch(() => !cancelled && setExisting(null))
      .finally(() => !cancelled && setLoadingDay(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email, dateCode]);

  const person = staff.find((s) => s.email.toLowerCase() === email);
  const entry = { email, name: person?.full_name || email, dateCode, checkIn, checkOut };
  const problem = manualEntryError(entry, today);
  const preview = !problem ? buildManualRecord(entry, scheduleFor(email), existing, new Date().toISOString()) : null;

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      await upsertOne("attendance", `${email}_${dateCode}`, preview);
      await insertOne("attendance_audit", {
        attendance_id: `${email}_${dateCode}`,
        employee_email: email,
        action: "manual_entry",
        before: existing ? { checkInTime: existing.checkInTime, checkOutTime: existing.checkOutTime, status: existing.status } : null,
        after: { checkInTime: preview.checkInTime, checkOutTime: preview.checkOutTime, status: preview.status },
        by_email: (user?.email || "").toLowerCase(),
        at: new Date().toISOString(),
      }).catch(() => undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const yesterday = dayBefore(today);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Davomatni qo'lda belgilash"
      description="Xodim o'zi belgilay olmagan kun uchun. Ketgan vaqtni bo'sh qoldirsangiz, xodim ishni tugatishni o'zi bosadi."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn-primary" disabled={!!problem || saving || loadingDay} onClick={() => void save()}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="label">Xodim</span>
          <select className="input" value={email} onChange={(e) => setEmail(e.target.value)}>
            <option value="">Tanlang…</option>
            {staff.map((s) => (
              <option key={s.email} value={s.email.toLowerCase()}>
                {s.full_name || s.email}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="label">Sana</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { code: today, label: "Bugun" },
              { code: yesterday, label: "Kecha" },
            ].map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => setDateCode(d.code)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${dateCode === d.code ? "bg-brand-600 text-white" : "border border-ink-200 text-ink-600 hover:bg-ink-50"}`}
              >
                {d.label}
              </button>
            ))}
            <input type="date" className="input w-auto" value={dateCode} max={today} onChange={(e) => e.target.value && setDateCode(e.target.value)} aria-label="Sana" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Kelgan vaqt</span>
            <input type="time" className="input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Ketgan vaqt (ixtiyoriy)</span>
            <input type="time" className="input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>

        {email && (
          <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
            {loadingDay ? (
              "Yuklanmoqda…"
            ) : (
              <>
                <div>
                  Ish vaqti: {scheduleFor(email).workStart}–{scheduleFor(email).workEnd}
                  {existing?.checkInTime ? ` · hozir saqlangan: ${existing.checkInTime}–${existing.checkOutTime || "…"}` : " · bu kun uchun yozuv yo'q"}
                </div>
                {preview && (
                  <div className="mt-1 font-semibold text-ink-800">
                    Natija: {preview.status}
                    {preview.lateMinutes ? ` · ${preview.lateMinutes} daq kechikish` : ""}
                    {preview.workedMinutes ? ` · ishlagan ${formatMinutes(preview.workedMinutes)}` : ""}
                    {preview.earlyLeaveMinutes ? ` · ${preview.earlyLeaveMinutes} daq erta ketish` : ""}
                    {preview.overtimeMinutes ? ` · ${preview.overtimeMinutes} daq qo'shimcha` : ""}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {(problem && email && checkIn) || error ? <div className="text-sm font-semibold text-rose-600">{error || problem}</div> : null}
      </div>
    </Modal>
  );
}
