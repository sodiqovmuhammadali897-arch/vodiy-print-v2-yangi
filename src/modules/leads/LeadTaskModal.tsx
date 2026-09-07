import { useEffect, useState } from "react";
import { listAll } from "../../lib/firestoreDb";
import { LEAD_TASK_TYPES } from "../../lib/orderConstants";
import { createLeadTask } from "../../lib/leadTasks";
import { useAuth } from "../../lib/AuthContext";
import type { Lead, LeadTaskType } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSaved: () => void;
};

export default function LeadTaskModal({ open, onClose, lead, onSaved }: Props) {
  const { user, staff } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [type, setType] = useState<LeadTaskType>("call");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("14:00");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    void listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }).then(setStaffList);
    setType("call");
    setDueDate(new Date().toISOString().slice(0, 10));
    setDueTime("14:00");
    setAssignedEmail(lead.assigned_to_email || user?.email?.toLowerCase() || "");
    setNote("");
  }, [open, lead, user]);

  const submit = async () => {
    if (!lead) return;
    setSaving(true);
    const assignedStaff = staffList.find((s) => s.email === assignedEmail);
    const actorEmail = user?.email?.toLowerCase() || "";
    const actorName = staff?.full_name || actorEmail;
    await createLeadTask(
      lead.id,
      lead.full_name,
      type,
      dueDate,
      dueTime,
      assignedEmail,
      assignedStaff?.full_name || "",
      note.trim(),
      actorEmail,
      actorName,
    );
    setSaving(false);
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vazifa qo'shish"
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
      <div className="space-y-4">
        <div>
          <label className="label">Vazifa turi</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as LeadTaskType)}>
            {LEAD_TASK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sana</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Vaqt</label>
            <input className="input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Mas'ul manager</label>
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
            className="input min-h-[64px]"
            placeholder="masalan: rang tanlovini so'rash"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
