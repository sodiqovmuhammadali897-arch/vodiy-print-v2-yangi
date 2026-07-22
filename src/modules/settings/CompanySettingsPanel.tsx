import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { getOne, upsertOne } from "../../lib/firestoreDb";
import type { CompanySettings } from "../../lib/types";

const SINGLETON_ID = "main";

const emptySettings = (): CompanySettings => ({
  id: SINGLETON_ID,
  singleton: true,
  name: "",
  logo_url: "",
  director_name: "",
  phone: "",
  extra_phone: "",
  email: "",
  telegram: "",
  website: "",
  address: "",
  stir: "",
  mfo: "",
  bank_account: "",
  bank_name: "",
  qr_url: "",
  work_hours: "",
  google_maps: "",
  instagram: "",
  facebook: "",
  youtube: "",
  requisites: "",
  stamp_url: "",
  signature_url: "",
  updated_at: new Date().toISOString(),
});

const fields: {
  key: keyof CompanySettings;
  label: string;
  full?: boolean;
  textarea?: boolean;
  type?: string;
  placeholder?: string;
}[] = [
  { key: "name", label: "Kompaniya nomi" },
  { key: "director_name", label: "Rahbar F.I.Sh." },
  { key: "phone", label: "Telefon", placeholder: "+998 ..." },
  { key: "extra_phone", label: "Qo'shimcha telefon" },
  { key: "email", label: "Email", type: "email" },
  { key: "telegram", label: "Telegram" },
  { key: "website", label: "Web sayt" },
  { key: "work_hours", label: "Ish vaqti" },
  { key: "address", label: "To'liq manzil", full: true },
  { key: "stir", label: "STIR" },
  { key: "mfo", label: "MFO" },
  { key: "bank_account", label: "Hisob raqami" },
  { key: "bank_name", label: "Bank nomi" },
  { key: "google_maps", label: "Google Maps havolasi", full: true },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "logo_url", label: "Logotip URL", full: true },
  { key: "qr_url", label: "QR kod URL", full: true },
  { key: "stamp_url", label: "Muhr rasmi URL", full: true },
  { key: "signature_url", label: "Imzo rasmi URL", full: true },
  { key: "requisites", label: "Rekvizitlar (matnli)", full: true, textarea: true },
];

export default function CompanySettingsPanel() {
  const [data, setData] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const existing = await getOne<CompanySettings>("company_settings", SINGLETON_ID);
      setData(existing ?? emptySettings());
    })();
  }, []);

  if (!data) {
    return <div className="card p-6 text-ink-500">Yuklanmoqda...</div>;
  }

  const set = (key: keyof CompanySettings, v: string) =>
    setData((d) => (d ? { ...d, [key]: v } : d));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { id: _ignored, ...rest } = data;
      await upsertOne("company_settings", SINGLETON_ID, {
        ...rest,
        updated_at: new Date().toISOString(),
      });
      setMsg("Saqlandi");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Xatolik");
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Kompaniya ma'lumotlari
          </h2>
          <p className="text-xs text-ink-500">
            Bu ma'lumotlar tijorat taklifi va boshqa hujjatlarda avtomatik ishlatiladi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <span className="text-xs font-semibold text-emerald-700">{msg}</span>
          )}
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>

      {(data.logo_url || data.stamp_url || data.signature_url || data.qr_url) && (
        <div className="mb-5 flex flex-wrap gap-4 rounded-xl bg-ink-50 p-4">
          {data.logo_url && <Preview label="Logo" url={data.logo_url} />}
          {data.stamp_url && <Preview label="Muhr" url={data.stamp_url} />}
          {data.signature_url && (
            <Preview label="Imzo" url={data.signature_url} />
          )}
          {data.qr_url && <Preview label="QR" url={data.qr_url} />}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key as string} className={f.full ? "md:col-span-2" : ""}>
            <label className="label">{f.label}</label>
            {f.textarea ? (
              <textarea
                className="input min-h-[90px]"
                value={(data[f.key] as string) || ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                className="input"
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={(data[f.key] as string) || ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={url}
        alt=""
        className="h-16 w-16 rounded-lg border border-ink-200 bg-white object-contain"
      />
      <div className="text-[11px] font-semibold text-ink-500">{label}</div>
    </div>
  );
}
