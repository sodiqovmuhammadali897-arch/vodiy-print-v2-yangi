import type { Manager } from "../../../lib/types";
import type { OrderPayload } from "../../../lib/orderService";
import type { DeadlineInfo } from "../../../lib/workingDays";
import {
  DELIVERY_TYPES,
  PRODUCTION_COMPANIES,
} from "../../../lib/orderConstants";

type Props = {
  payload: OrderPayload;
  set: <K extends keyof OrderPayload>(key: K, v: OrderPayload[K]) => void;
  managers: Manager[];
  customProduction: boolean;
  setCustomProduction: (v: boolean) => void;
  dl: DeadlineInfo | null;
};

export default function ProductionStep({
  payload,
  set,
  managers,
  customProduction,
  setCustomProduction,
  dl,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Ishlab chiqaruvchi kompaniya
        </h2>
        <p className="text-xs text-ink-500">
          Buyurtma qaysi kompaniyada tayyorlanadi
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRODUCTION_COMPANIES.map((p) => {
            const active = payload.production_company === p.key && !customProduction;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setCustomProduction(false);
                  set("production_company", p.key);
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? `${p.color} border-transparent shadow-sm`
                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                }`}
              >
                {p.key}
              </button>
            );
          })}
          <button
            onClick={() => {
              setCustomProduction(true);
              set("production_company", "");
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              customProduction
                ? "bg-ink-900 text-white border-transparent"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
            }`}
          >
            Boshqa
          </button>
        </div>
        {customProduction && (
          <input
            className="input mt-3"
            placeholder="Ishlab chiqaruvchi nomi"
            value={payload.production_company}
            onChange={(e) => set("production_company", e.target.value)}
          />
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Mas'ul shaxslar
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ManagerField
            label="Ishlab chiqarish mas'uli"
            value={payload.production_manager}
            managers={managers}
            onChange={(v) => set("production_manager", v)}
          />
          <ManagerField
            label="Logistika mas'uli"
            value={payload.logistics_manager}
            managers={managers}
            onChange={(v) => set("logistics_manager", v)}
          />
          <ManagerField
            label="Sifat nazorati"
            value={payload.qc_manager}
            managers={managers}
            onChange={(v) => set("qc_manager", v)}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Deadline</h2>
            <p className="text-xs text-ink-500">
              Bajarilishi kerak bo'lgan sana (yakshanba va bayram kunlari hisobga
              olinmaydi)
            </p>
          </div>
          {dl && (
            <span
              className={`chip ${
                dl.tone === "rose"
                  ? "bg-rose-100 text-rose-700"
                  : dl.tone === "amber"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {dl.label}
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Deadline sanasi</label>
            <input
              type="date"
              className="input"
              value={payload.deadline || ""}
              onChange={(e) => set("deadline", e.target.value || null)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Yetkazish</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Yetkazish turi</label>
            <select
              className="input"
              value={payload.delivery_type}
              onChange={(e) => set("delivery_type", e.target.value)}
            >
              <option value="">-- tanlang --</option>
              {DELIVERY_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sana</label>
            <input
              type="date"
              className="input"
              value={payload.delivery_date || ""}
              onChange={(e) => set("delivery_date", e.target.value || null)}
            />
          </div>
          <div>
            <label className="label">Vaqt</label>
            <input
              className="input"
              placeholder="15:00"
              value={payload.delivery_time}
              onChange={(e) => set("delivery_time", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Manzil</label>
            <input
              className="input"
              value={payload.delivery_address}
              onChange={(e) => set("delivery_address", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Xarita havolasi</label>
            <input
              className="input"
              placeholder="https://maps..."
              value={payload.delivery_location_url}
              onChange={(e) => set("delivery_location_url", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              className="input"
              value={payload.delivery_phone}
              onChange={(e) => set("delivery_phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Kuryer</label>
            <input
              className="input"
              value={payload.courier}
              onChange={(e) => set("courier", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Yetkazish narxi</label>
            <input
              type="number"
              className="input"
              value={payload.delivery_cost || ""}
              onChange={(e) =>
                set("delivery_cost", Number(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Izohlar</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <NoteField
            label="Mijozning talabi"
            value={payload.client_request_note}
            onChange={(v) => set("client_request_note", v)}
          />
          <NoteField
            label="Mijoz uchun izoh"
            value={payload.customer_note}
            onChange={(v) => set("customer_note", v)}
          />
          <NoteField
            label="Ishlab chiqarish izohi"
            value={payload.production_note}
            onChange={(v) => set("production_note", v)}
          />
          <NoteField
            label="Logistika izohi"
            value={payload.logistics_note}
            onChange={(v) => set("logistics_note", v)}
          />
          <div className="md:col-span-2">
            <label className="label">
              Ichki (maxfiy) izoh — mijoz hujjatlarida ko'rinmaydi
            </label>
            <textarea
              className="input min-h-[80px]"
              value={payload.private_note}
              onChange={(e) => set("private_note", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerField({
  label,
  value,
  managers,
  onChange,
}: {
  label: string;
  value: string;
  managers: Manager[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        list={`mgr-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={`mgr-${label}`}>
        {managers.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>
    </div>
  );
}

function NoteField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[70px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
