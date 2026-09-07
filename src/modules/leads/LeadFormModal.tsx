import { useEffect, useState } from "react";
import { insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import { CUSTOMER_SOURCES } from "../../lib/orderConstants";
import type { Lead } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSaved: () => void;
};

export default function LeadFormModal({ open, onClose, lead, onSaved }: Props) {
  const { staff, user } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }).then(setStaffList);
    if (lead) {
      setFullName(lead.full_name);
      setPhone(lead.phone);
      setSource(lead.source);
      setAssignedEmail(lead.assigned_to_email);
      setNote(lead.note);
    } else {
      setFullName("");
      setPhone("");
      setSource("");
      setAssignedEmail(user?.email?.toLowerCase() || "");
      setNote("");
    }
    setError(null);
  }, [open, lead, user]);

  const submit = async () => {
    if (!fullName.trim()) return setError("Ism yoki kompaniya nomini kiriting");
    if (!phone.trim()) return setError("Telefon raqamini kiriting");
    setSaving(true);
    setError(null);
    try {
      const assignedStaff = staffList.find((s) => s.email === assignedEmail);
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        source,
        assigned_to_email: assignedEmail,
        assigned_to_name: assignedStaff?.full_name || "",
        note: note.trim(),
        updated_at: new Date().toISOString(),
      };
      if (lead) {
        await updateOne("leads", lead.id, payload);
      } else {
        await insertOne("leads", {
          ...payload,
          status: "new",
          lost_reason: "",
          converted_customer_id: null,
        });
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? "Lidni tahrirlash" : "Yangi lid qo'shish"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      <div className="space-y-4">
        <div>
          <label className="label">Ism / kompaniya *</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Telefon *</label>
          <input
            className="input"
            placeholder="+998 90 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Manba</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">-- tanlang --</option>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Mas'ul menejer</label>
          <select className="input" value={assignedEmail} onChange={(e) => setAssignedEmail(e.target.value)}>
            <option value="">-- tanlanmagan --</option>
            {staffList.map((s) => (
              <option key={s.email} value={s.email}>
                {s.full_name} {s.email === staff?.email ? "(Men)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[70px]"
            placeholder="masalan: flayer haqida so'radi"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
