import { useEffect, useState } from "react";
import { insertOne, updateOne } from "../../lib/firestoreDb";
import type { Task } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  staff: Staff[];
  onSaved: () => void;
};

export default function TaskFormModal({ open, onClose, task, staff, onSaved }: Props) {
  const { user, staff: currentStaff } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToEmail, setAssignedToEmail] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignedToEmail(task.assigned_to_email);
      setDueDate(task.due_date || "");
    } else {
      setTitle("");
      setDescription("");
      setAssignedToEmail(staff[0]?.email || "");
      setDueDate("");
    }
    setError(null);
  }, [task, open, staff]);

  const submit = async () => {
    if (!title.trim()) return setError("Vazifa nomi kiritilishi shart");
    if (!assignedToEmail) return setError("Xodim tanlanishi shart");
    setSaving(true);
    setError(null);
    try {
      const assignee = staff.find((s) => s.email === assignedToEmail);
      if (task) {
        await updateOne("tasks", task.id, {
          title: title.trim(),
          description: description.trim(),
          assigned_to_email: assignedToEmail,
          assigned_to_name: assignee?.full_name || assignedToEmail,
          due_date: dueDate || null,
        });
      } else {
        await insertOne("tasks", {
          title: title.trim(),
          description: description.trim(),
          assigned_to_email: assignedToEmail,
          assigned_to_name: assignee?.full_name || assignedToEmail,
          assigned_by_email: user?.email || "",
          assigned_by_name: currentStaff?.full_name || user?.email || "",
          due_date: dueDate || null,
          status: "new",
          completed_at: null,
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
      title={task ? "Vazifani tahrirlash" : "Yangi vazifa"}
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
      <div className="space-y-3">
        <div>
          <label className="label">Vazifa nomi *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Tavsif</label>
          <textarea
            className="input min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Xodim *</label>
            <select
              className="input"
              value={assignedToEmail}
              onChange={(e) => setAssignedToEmail(e.target.value)}
            >
              <option value="">-- tanlang --</option>
              {staff.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Muddati</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
