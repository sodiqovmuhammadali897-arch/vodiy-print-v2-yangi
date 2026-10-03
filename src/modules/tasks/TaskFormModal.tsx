import { useEffect, useState } from "react";
import { insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import type { Customer, Order, Task, TaskPriority, TaskRepeat } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import { TASK_PRIORITY } from "../../lib/taskStatus";
import Modal from "../../components/ui/Modal";

// Pre-filled link when a task is created from an order page.
export type TaskPreset = {
  order_id?: string;
  order_number?: string;
  customer_id?: string | null;
  customer_name?: string;
  title?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  staff: Staff[];
  onSaved: () => void;
  preset?: TaskPreset | null;
};

type RepeatKind = "none" | TaskRepeat["type"];
const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const todayISO = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const customerLabel = (c: Customer) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.phone;

const ALL = "__all__";

export default function TaskFormModal({ open, onClose, task, staff, onSaved, preset = null }: Props) {
  const { user, staff: currentStaff } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToEmail, setAssignedToEmail] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Orders / customers only load for staff allowed to read them.
    void listAll<Order>("orders")
      .then((rows) =>
        setOrders(
          rows
            .filter((o) => !o.is_draft && !o.is_historical && o.status !== "cancelled")
            .sort((a, b) => String(b.order_date || b.created_at).localeCompare(String(a.order_date || a.created_at)))
            .slice(0, 300),
        ),
      )
      .catch(() => setOrders([]));
    void listAll<Customer>("customers")
      .then((rows) => setCustomers(rows.sort((a, b) => customerLabel(a).localeCompare(customerLabel(b)))))
      .catch(() => setCustomers([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignedToEmail(task.assigned_to_email);
      setDueDate(task.due_date || "");
      setPriority(task.priority || "normal");
      setOrderId(task.order_id || "");
      setCustomerId(task.customer_id || "");
    } else {
      setTitle(preset?.title || "");
      setDescription("");
      setAssignedToEmail(staff[0]?.email || "");
      setDueDate("");
      setPriority("normal");
      setOrderId(preset?.order_id || "");
      setCustomerId(preset?.customer_id || "");
    }
    setRepeat("none");
    setWeekday(((new Date().getDay() + 6) % 7) + 1);
    setMonthDay(new Date().getDate());
    setError(null);
  }, [task, open, staff, preset]);

  const pickOrder = (id: string) => {
    setOrderId(id);
    const o = orders.find((x) => x.id === id);
    if (o?.customer_id) setCustomerId(o.customer_id);
  };

  const links = () => {
    const o = orders.find((x) => x.id === orderId);
    const c = customers.find((x) => x.id === customerId);
    return {
      order_id: orderId || null,
      order_number: o?.order_number || (orderId && orderId === preset?.order_id ? preset?.order_number || "" : task?.order_number || ""),
      customer_id: customerId || null,
      customer_name: c ? customerLabel(c) : customerId && customerId === preset?.customer_id ? preset?.customer_name || "" : task?.customer_name || "",
    };
  };

  const submit = async () => {
    if (!title.trim()) return setError("Vazifa nomi kiritilishi shart");
    if (!assignedToEmail) return setError("Xodim tanlanishi shart");
    setSaving(true);
    setError(null);
    try {
      const me = (user?.email || "").toLowerCase();
      const meName = currentStaff?.full_name || user?.email || "";
      const baseFor = (email: string) => ({
        title: title.trim(),
        description: description.trim(),
        assigned_to_email: email,
        assigned_to_name: staff.find((s) => s.email === email)?.full_name || email,
        due_date: dueDate || null,
        priority,
        ...links(),
      });
      // "Hamma xodimlarga": everyone but the one giving it gets their own
      // copy (own status, reminders and rating).
      const targets = assignedToEmail === ALL ? staff.map((s) => s.email).filter((e) => e.toLowerCase() !== me) : [assignedToEmail];
      if (task) {
        await updateOne("tasks", task.id, baseFor(assignedToEmail));
      } else {
        for (const email of targets) {
          const base = baseFor(email);
          let templateId: string | null = null;
          if (repeat !== "none") {
            const rep: TaskRepeat =
              repeat === "weekly" ? { type: "weekly", weekday } : repeat === "monthly" ? { type: "monthly", day: monthDay } : { type: "daily" };
            const dueIn = dueDate ? Math.max(0, Math.round((Date.parse(dueDate) - Date.parse(todayISO())) / 86400000)) : 0;
            const tpl = await insertOne("task_templates", {
              title: base.title,
              description: base.description,
              assigned_to_email: base.assigned_to_email,
              assigned_to_name: base.assigned_to_name,
              assigned_by_email: me,
              assigned_by_name: meName,
              priority,
              repeat: rep,
              due_in_days: dueIn,
              active: true,
              // The first one is created right now, below.
              last_created_date: todayISO(),
            });
            templateId = tpl.id;
          }
          await insertOne("tasks", {
            ...base,
            assigned_by_email: me,
            assigned_by_name: meName,
            status: "new",
            started_at: null,
            completed_at: null,
            template_id: templateId,
            history: [{ status: "new", at: new Date().toISOString(), by_name: meName, by_email: me }],
          });
        }
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
      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="space-y-3">
        <div>
          <label className="label">Vazifa nomi *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Tavsif</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Xodim *</label>
            <select className="input" value={assignedToEmail} onChange={(e) => setAssignedToEmail(e.target.value)}>
              <option value="">-- tanlang --</option>
              {!task && staff.length > 1 && <option value={ALL}>👥 Hamma xodimlarga ({staff.filter((s) => s.email.toLowerCase() !== (user?.email || "").toLowerCase()).length} kishi)</option>}
              {staff.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Muddati</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Muhimligi</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {(Object.keys(TASK_PRIORITY) as TaskPriority[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_PRIORITY[k].icon} {TASK_PRIORITY[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(orders.length > 0 || customers.length > 0 || preset?.order_id) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Buyurtmaga bog'lash</label>
              <select className="input" value={orderId} onChange={(e) => pickOrder(e.target.value)}>
                <option value="">— bog'lanmagan —</option>
                {preset?.order_id && !orders.some((o) => o.id === preset.order_id) && <option value={preset.order_id}>{preset.order_number || "Buyurtma"}</option>}
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} · {o.title || ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Mijozga bog'lash</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— bog'lanmagan —</option>
                {preset?.customer_id && !customers.some((c) => c.id === preset.customer_id) && <option value={preset.customer_id}>{preset.customer_name || "Mijoz"}</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {customerLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!task && (
          <div className="rounded-xl bg-ink-50 p-3">
            <label className="label">Takrorlansinmi?</label>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input w-auto" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
                <option value="none">Yo'q, bir martalik</option>
                <option value="daily">Har kuni (yakshanbadan tashqari)</option>
                <option value="weekly">Har hafta</option>
                <option value="monthly">Har oy</option>
              </select>
              {repeat === "weekly" && (
                <select className="input w-auto" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
              {repeat === "monthly" && (
                <select className="input w-auto" value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}-sana
                    </option>
                  ))}
                </select>
              )}
            </div>
            {repeat !== "none" && (
              <p className="mt-1.5 text-xs text-ink-500">
                Birinchisi hozir yaratiladi, keyingilari tanlangan kunlarda ertalab o'zi paydo bo'ladi.
                {dueDate ? " Muddat har safar shuncha kun keyin qo'yiladi." : " Muddat — yaratilgan kunning o'zi."}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
