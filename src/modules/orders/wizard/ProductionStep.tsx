import { useState } from "react";
import { Plus, Shirt } from "lucide-react";
import { insertOne } from "../../../lib/firestoreDb";
import { nextTextileCompanyNumber } from "../../../lib/numbering";
import type { Manager, TextileCompany } from "../../../lib/types";
import type { OrderPayload } from "../../../lib/orderService";
import type { DeadlineInfo } from "../../../lib/workingDays";
import {
  DELIVERY_TYPES,
  PRODUCTION_COMPANIES,
} from "../../../lib/orderConstants";
import Modal from "../../../components/ui/Modal";

type Props = {
  payload: OrderPayload;
  set: <K extends keyof OrderPayload>(key: K, v: OrderPayload[K]) => void;
  managers: Manager[];
  textileCompanies: TextileCompany[];
  onTextileCompanyCreated: (c: TextileCompany) => void;
  customProduction: boolean;
  setCustomProduction: (v: boolean) => void;
  dl: DeadlineInfo | null;
};

export default function ProductionStep({
  payload,
  set,
  managers,
  textileCompanies,
  onTextileCompanyCreated,
  customProduction,
  setCustomProduction,
  dl,
}: Props) {
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    telegram: "",
    address: "",
    note: "",
  });
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const activeTextile = textileCompanies.filter((c) => c.is_active);

  const createTextile = async () => {
    if (!txForm.name.trim()) {
      setTxError("Nom kiriting");
      return;
    }
    setTxSaving(true);
    setTxError(null);
    try {
      const number = await nextTextileCompanyNumber();
      const created = await insertOne("textile_companies", {
        ...txForm,
        company_number: number,
        is_active: true,
      });
      setTxSaving(false);
      onTextileCompanyCreated(created as unknown as TextileCompany);
      set("textile_company_id", created.id);
      set("textile_company_name", created.name as string);
      setTxOpen(false);
      setTxForm({
        name: "",
        contact_person: "",
        phone: "",
        telegram: "",
        address: "",
        note: "",
      });
    } catch (e) {
      setTxSaving(false);
      setTxError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  const selectedTextile = textileCompanies.find(
    (c) => c.id === payload.textile_company_id,
  );

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">
              Textil ishlab chiqaruvchi
            </h2>
            <p className="text-xs text-ink-500">
              Faqat textil buyurtmalari uchun. Bo'sh qoldirsangiz, bu bo'lim
              inobatga olinmaydi.
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setTxOpen(true)}>
            <Plus className="h-4 w-4" /> Yangi kompaniya
          </button>
        </div>
        <div className="mt-3">
          <select
            className="input"
            value={payload.textile_company_id || ""}
            onChange={(e) => {
              const id = e.target.value || null;
              const c = textileCompanies.find((x) => x.id === id);
              set("textile_company_id", id);
              set("textile_company_name", c?.name || "");
            }}
          >
            <option value="">-- kompaniyaga buyurtma berilmagan --</option>
            {activeTextile.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_number ? `${c.company_number} · ` : ""}
                {c.name}
              </option>
            ))}
          </select>
          {payload.textile_company_id && !selectedTextile && payload.textile_company_name && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Saqlangan kompaniya: {payload.textile_company_name} (bazadan olib
              tashlangan yoki nofaol)
            </div>
          )}
          {selectedTextile && (
            <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-xs text-ink-700">
              <div className="flex flex-wrap items-center gap-2">
                <Shirt className="h-4 w-4 text-brand-700" />
                <span className="font-semibold text-ink-900">
                  {selectedTextile.name}
                </span>
                {selectedTextile.company_number && (
                  <span className="text-brand-700">
                    {selectedTextile.company_number}
                  </span>
                )}
                {!selectedTextile.is_active && (
                  <span className="chip bg-ink-200 text-ink-700">Nofaol</span>
                )}
              </div>
              <div className="mt-1 space-x-3">
                {selectedTextile.contact_person && (
                  <span>Mas'ul: {selectedTextile.contact_person}</span>
                )}
                {selectedTextile.phone && (
                  <span>Tel: {selectedTextile.phone}</span>
                )}
                {selectedTextile.telegram && (
                  <span>{selectedTextile.telegram}</span>
                )}
              </div>
            </div>
          )}
        </div>
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

      <Modal
        open={txOpen}
        onClose={() => setTxOpen(false)}
        title="Yangi textil kompaniyasi"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTxOpen(false)}>
              Bekor qilish
            </button>
            <button className="btn-primary" onClick={createTextile} disabled={txSaving}>
              {txSaving ? "Saqlanmoqda..." : "Yaratish"}
            </button>
          </>
        }
      >
        {txError && (
          <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {txError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Kompaniya nomi *</label>
            <input
              className="input"
              value={txForm.name}
              onChange={(e) => setTxForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Mas'ul shaxs</label>
            <input
              className="input"
              value={txForm.contact_person}
              onChange={(e) =>
                setTxForm((f) => ({ ...f, contact_person: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              className="input"
              value={txForm.phone}
              onChange={(e) => setTxForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Telegram</label>
            <input
              className="input"
              value={txForm.telegram}
              onChange={(e) =>
                setTxForm((f) => ({ ...f, telegram: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Manzil</label>
            <input
              className="input"
              value={txForm.address}
              onChange={(e) =>
                setTxForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Izoh</label>
            <textarea
              className="input min-h-[60px]"
              value={txForm.note}
              onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
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
