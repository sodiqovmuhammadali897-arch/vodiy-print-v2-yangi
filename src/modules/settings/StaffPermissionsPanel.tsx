import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { listAll, upsertOne, deleteOne } from "../../lib/firestoreDb";
import {
  MODULES,
  emptyPermissions,
  fullPermissions,
  type ModuleKey,
  type PermissionAction,
  type Staff,
  type StaffRole,
} from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";
import AsyncState from "../../components/ui/AsyncState";

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "Ko'rish" },
  { key: "edit", label: "Tahrirlash" },
  { key: "delete", label: "O'chirish" },
];

export default function StaffPermissionsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listAll<Staff>("staff", { orderBy: ["email", "asc"] });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setModalOpen(true);
  };

  const remove = async (email: string) => {
    if (email === user?.email) {
      alert("O'zingizning hisobingizni o'chira olmaysiz");
      return;
    }
    if (!confirm(`${email} uchun ruxsatlarni o'chirishni tasdiqlaysizmi?`)) return;
    await deleteOne("staff", email);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Xodimlar va ruxsatlar
          </h2>
          <p className="max-w-2xl text-sm text-ink-500">
            Har bir xodim uchun qaysi bo'limlar ko'rinishi, tahrirlash va
            o'chirish mumkinligini belgilang. Xodim avval{" "}
            <strong>Firebase Console'da</strong> login/parol bilan yaratilgan
            bo'lishi kerak — bu yerda faqat ruxsatlar boshqariladi.
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="h-4 w-4" /> Xodim qo'shish
        </button>
      </div>

      <div className="card overflow-hidden">
        <AsyncState
          loading={loading}
          empty={rows.length === 0}
          emptyLabel="Xodimlar qo'shilmagan"
          emptyIcon={<Users className="h-5 w-5" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Email</th>
                  <th className="table-th">Ism</th>
                  <th className="table-th">Rol</th>
                  <th className="table-th text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((s) => (
                  <tr key={s.email} className="hover:bg-ink-50/50">
                    <td className="table-td font-medium text-ink-800">
                      {s.email}
                    </td>
                    <td className="table-td">{s.full_name || "-"}</td>
                    <td className="table-td">
                      {s.role === "admin" ? (
                        <span className="chip inline-flex items-center gap-1 bg-amber-100 text-amber-800">
                          <ShieldCheck className="h-3.5 w-3.5" /> Admin
                        </span>
                      ) : (
                        <span className="chip bg-ink-100 text-ink-700">
                          Xodim
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost text-rose-600 hover:bg-rose-50"
                          onClick={() => remove(s.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>

      <StaffFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        staff={editing}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}

type FormProps = {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  onSaved: () => void;
};

function StaffFormModal({ open, onClose, staff, onSaved }: FormProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (staff) {
      setEmail(staff.email);
      setFullName(staff.full_name);
      setRole(staff.role);
      setPermissions(staff.permissions || emptyPermissions());
    } else {
      setEmail("");
      setFullName("");
      setRole("staff");
      setPermissions(emptyPermissions());
    }
    setError(null);
  }, [staff, open]);

  const toggle = (moduleKey: ModuleKey, action: PermissionAction) => {
    setPermissions((p) => {
      const current = p[moduleKey][action];
      const modulePerm = { ...p[moduleKey], [action]: !current };
      if (action !== "view" && modulePerm[action]) {
        modulePerm.view = true;
      }
      if (action === "view" && !modulePerm.view) {
        modulePerm.edit = false;
        modulePerm.delete = false;
      }
      return { ...p, [moduleKey]: modulePerm };
    });
  };

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return setError("Email kiritilishi shart");
    if (!fullName.trim()) return setError("Ism kiritilishi shart");
    setSaving(true);
    setError(null);
    try {
      await upsertOne<Staff>("staff", trimmedEmail, {
        email: trimmedEmail,
        full_name: fullName.trim(),
        role,
        permissions: role === "admin" ? fullPermissions() : permissions,
      });
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
      title={staff ? "Xodim ruxsatlarini tahrirlash" : "Yangi xodim qo'shish"}
      size="lg"
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
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Email *</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!staff}
            placeholder="xodim@example.com"
          />
          <p className="mt-1 text-xs text-ink-500">
            Firebase Authentication'da shu email bilan hisob avval yaratilgan
            bo'lishi kerak.
          </p>
        </div>
        <div>
          <label className="label">To'liq ism *</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Rol</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value="staff">Xodim (belgilangan ruxsatlar bilan)</option>
            <option value="admin">Admin (to'liq huquq)</option>
          </select>
        </div>
      </div>

      {role === "staff" && (
        <div className="mt-4">
          <label className="label">Bo'limlar bo'yicha ruxsatlar</label>
          <div className="overflow-x-auto rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60">
                <tr>
                  <th className="table-th">Bo'lim</th>
                  {ACTIONS.map((a) => (
                    <th key={a.key} className="table-th text-center">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {MODULES.map((m) => (
                  <tr key={m.key}>
                    <td className="table-td">{m.label}</td>
                    {ACTIONS.map((a) => (
                      <td key={a.key} className="table-td text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={permissions[m.key][a.key]}
                          onChange={() => toggle(m.key, a.key)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
