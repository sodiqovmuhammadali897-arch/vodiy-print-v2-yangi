import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../../../components/ui/Modal";
import { CRM_SOURCES, PRODUCT_TYPES } from "../../../lib/crm";
import { createCrmLead, leadByPhone, type Actor } from "../../../lib/crmService";
import type { Lead } from "../../../lib/types";

// A new lead by hand: phone first (a lead with the same number is shown
// before a duplicate is made), then who, what and the first call.
type Props = {
  onClose: () => void;
  onCreated: (id: string) => void;
  sellers: { email: string; name: string }[];
  actor: Actor;
  isAdmin: boolean;
};

const tashToday = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

export default function NewLeadModal({ onClose, onCreated, sellers, actor, isAdmin }: Props) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [source, setSource] = useState("");
  const [product, setProduct] = useState("");
  const [owner, setOwner] = useState(actor.email);
  const [date, setDate] = useState(tashToday());
  const [time, setTime] = useState("");
  const [dup, setDup] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void leadByPhone(phone)
        .then((l) => live && setDup(l))
        .catch(() => live && setDup(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [phone]);

  const save = async () => {
    if (!phone.replace(/\D/g, "") && !name.trim() && !brand.trim()) return setError("Telefon, ism yoki brendni yozing");
    setSaving(true);
    setError(null);
    try {
      const o = sellers.find((s) => s.email === owner) || { email: actor.email, name: actor.name };
      const id = await createCrmLead(
        {
          phone: phone.trim(),
          full_name: name.trim(),
          brand: brand.trim(),
          source,
          product_types: product ? [product] : [],
          interested_product_name: product,
          assigned_to_email: o.email,
          assigned_to_name: o.name,
        },
        actor,
        { date, time },
      );
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Yangi lid"
      description="Birinchi zadacha — «Qo'ng'iroq qilish» — o'zi qo'yiladi."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saqlanmoqda…" : "Lid ochish"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Telefon</label>
          <input className="input" inputMode="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
          {dup && (
            <div className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              Bu raqam bilan lid bor: <b>{dup.lead_number}</b> {dup.brand || dup.full_name} ({dup.assigned_to_name || "mas'ulsiz"}).{" "}
              <Link to={`/leads/${dup.id}`} className="font-semibold underline" onClick={onClose}>
                Ochish
              </Link>
            </div>
          )}
        </div>
        <div>
          <label className="label">Ism</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Brend / kompaniya</label>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div>
          <label className="label">Manba</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {CRM_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Mahsulot</label>
          <select className="input" value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">—</option>
            {PRODUCT_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div className="sm:col-span-2">
            <label className="label">Mas'ul menejer</label>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {!sellers.some((s) => s.email === actor.email) && <option value={actor.email}>{actor.name} (o'zim)</option>}
              {sellers.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Qo'ng'iroq — sana</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Vaqt (ixtiyoriy)</label>
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </Modal>
  );
}
