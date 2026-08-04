import { useEffect, useState } from "react";
import { Clock, MapPin, Save } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import type { WorkSchedule } from "../../lib/types";
import { getCurrentPosition } from "../../utils/locationUtils";

const SINGLETON_ID = "default";

const WEEKDAYS = [
  { value: 0, label: "Yakshanba" },
  { value: 1, label: "Dushanba" },
  { value: 2, label: "Seshanba" },
  { value: 3, label: "Chorshanba" },
  { value: 4, label: "Payshanba" },
  { value: 5, label: "Juma" },
  { value: 6, label: "Shanba" },
];

const emptySchedule = (): WorkSchedule => ({
  id: SINGLETON_ID,
  workStart: "09:00",
  workEnd: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  breakMinutes: 60,
  weeklyOffDay: 0,
  officeLat: 0,
  officeLng: 0,
  officeRadiusMeters: 150,
  gpsCheckEnabled: false,
});

export default function WorkSchedulePanel() {
  const [schedule, setSchedule] = useState<WorkSchedule>(emptySchedule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const doc = await getOne<WorkSchedule>("work_schedules", SINGLETON_ID);
      if (doc) setSchedule({ ...emptySchedule(), ...doc });
      setLoading(false);
    })();
  }, []);

  const patch = (p: Partial<WorkSchedule>) => setSchedule((s) => ({ ...s, ...p }));

  const useMyLocation = async () => {
    setLocating(true);
    setMessage(null);
    try {
      const pos = await getCurrentPosition();
      patch({ officeLat: pos.latitude, officeLng: pos.longitude });
      setMessage("Joriy joylashuv olindi — saqlashni unutmang");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Joylashuvni aniqlab bo'lmadi");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await upsertOne<WorkSchedule>("work_schedules", SINGLETON_ID, {
        ...schedule,
        updatedAt: new Date().toISOString(),
      });
      setMessage("Saqlandi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-ink-500">Yuklanmoqda...</div>;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-base font-bold text-ink-900">Ish vaqti</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="label">Ish boshlanishi</label>
            <input type="time" className="input" value={schedule.workStart} onChange={(e) => patch({ workStart: e.target.value })} />
          </div>
          <div>
            <label className="label">Ish tugashi</label>
            <input type="time" className="input" value={schedule.workEnd} onChange={(e) => patch({ workEnd: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanaffus boshlanishi</label>
            <input type="time" className="input" value={schedule.breakStart} onChange={(e) => patch({ breakStart: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanaffus tugashi</label>
            <input type="time" className="input" value={schedule.breakEnd} onChange={(e) => patch({ breakEnd: e.target.value })} />
          </div>
          <div>
            <label className="label">Tanaffus (daqiqa)</label>
            <input
              type="number"
              className="input"
              value={schedule.breakMinutes || ""}
              onChange={(e) => patch({ breakMinutes: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Dam olish kuni</label>
            <select
              className="input"
              value={schedule.weeklyOffDay}
              onChange={(e) => patch({ weeklyOffDay: Number(e.target.value) })}
            >
              {WEEKDAYS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-base font-bold text-ink-900">Ofis joylashuvi (GPS)</h2>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={schedule.gpsCheckEnabled}
            onChange={(e) => patch({ gpsCheckEnabled: e.target.checked })}
          />
          GPS tekshiruvini yoqish (ofisdan tashqarida davomat belgilab bo'lmaydi)
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">Latitude</label>
            <input
              type="number"
              step="any"
              className="input"
              value={schedule.officeLat || ""}
              onChange={(e) => patch({ officeLat: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              type="number"
              step="any"
              className="input"
              value={schedule.officeLng || ""}
              onChange={(e) => patch({ officeLng: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Radius (metr)</label>
            <input
              type="number"
              className="input"
              value={schedule.officeRadiusMeters || ""}
              onChange={(e) => patch({ officeRadiusMeters: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <button className="btn-secondary mt-3" onClick={useMyLocation} disabled={locating}>
          <MapPin className="h-4 w-4" />
          {locating ? "Aniqlanmoqda..." : "Joriy joylashuvni olish (ofisda turib bosing)"}
        </button>
      </div>

      {message && <div className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-sky-800">{message}</div>}

      <button className="btn-primary" onClick={save} disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </div>
  );
}
