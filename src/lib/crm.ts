// The ERP's own CRM (the owner's request, 2026-11-12: «amoCRM'day»):
// the same stages and lead fields as the team's amoCRM (read with
// amo-audit.yml), tasks with a deadline and a required result, and the
// rules the board highlights (a late task, an open lead with no task).
// Pure helpers here; the pages are src/modules/leads/crm/*.
import type { Lead, LeadStatus, LeadTask, Order, OrderStatus } from "./types";

export type CrmColumn = "new" | "accepted" | "info_given" | "offer" | "advance" | "production" | "delivered";

// amoCRM: Неразобранное → Қабул Қилинди → маълумот берилди → Таклиф Юборилди
// → Дизайн/аванс → ишлаб чикариш → етказилди (+ Муваффақиятсиз).
export const CRM_COLUMNS: { key: CrmColumn; label: string; color: string }[] = [
  { key: "new", label: "Yangi", color: "#94a3b8" },
  { key: "accepted", label: "Qabul qilindi", color: "#38bdf8" },
  { key: "info_given", label: "Ma'lumot berildi", color: "#818cf8" },
  { key: "offer", label: "Taklif yuborildi", color: "#a78bfa" },
  { key: "advance", label: "Dizayn / avans", color: "#f59e0b" },
  { key: "production", label: "Ishlab chiqarish", color: "#10b981" },
  { key: "delivered", label: "Yetkazildi", color: "#16a34a" },
];
export const columnLabel = (c: CrmColumn) => CRM_COLUMNS.find((x) => x.key === c)?.label || c;

// The stages a manager sets by hand; from «Dizayn / avans» on the lead has
// an order and its column follows the order's status.
export const MANUAL_COLUMNS: CrmColumn[] = ["new", "accepted", "info_given", "offer"];

const fromOrder = (s: OrderStatus): CrmColumn => {
  if (s === "sent_to_production" || s === "production" || s === "quality_control" || s === "ready" || s === "ready_to_deliver") return "production";
  if (s === "delivered" || s === "closed") return "delivered";
  return "advance";
};

// Where a lead sits on the board; null = lost or its order was cancelled.
export function columnOf(lead: Pick<Lead, "status" | "converted_order_id">, orders: Record<string, Pick<Order, "status">>): CrmColumn | null {
  const s: LeadStatus = lead.status;
  if (s === "lost") return null;
  if (lead.converted_order_id) {
    const o = orders[lead.converted_order_id];
    if (!o) return "advance";
    if (o.status === "cancelled") return null;
    return fromOrder(o.status);
  }
  if (s === "telegram") return "info_given"; // the first version's stage
  if (s === "new" || s === "accepted" || s === "info_given" || s === "offer") return s;
  return "advance";
}

// A task's due moment in Tashkent (UTC+5), as an epoch.
export const taskDueAt = (t: Pick<LeadTask, "due_date" | "due_time">) =>
  Date.parse(`${t.due_date}T${/^\d{2}:\d{2}$/.test(t.due_time || "") ? t.due_time : "23:59"}:00+05:00`);

export type TaskState = "late" | "today" | "later";
const tashDay = (ms: number) => new Date(ms + 5 * 3600e3).toISOString().slice(0, 10);
export function taskState(t: Pick<LeadTask, "due_date" | "due_time">, now = Date.now()): TaskState {
  const due = taskDueAt(t);
  if (due < now) return "late";
  return t.due_date === tashDay(now) ? "today" : "later";
}

// "bugun 15:00", "ertaga 10:00", "kecha 16:00", "3 kun o'tdi", "14-noy".
export function dueLabel(t: Pick<LeadTask, "due_date" | "due_time">, now = Date.now()): string {
  const today = tashDay(now);
  const diff = Math.round((Date.parse(t.due_date) - Date.parse(today)) / 86400000);
  const time = t.due_time ? ` ${t.due_time}` : "";
  if (diff === 0) return `bugun${time}`;
  if (diff === 1) return `ertaga${time}`;
  if (diff === -1) return `kecha${time}`;
  if (diff < -1) return `${-diff} kun o'tdi`;
  const d = new Date(t.due_date);
  const mon = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"][d.getUTCMonth()];
  return `${d.getUTCDate()}-${mon}${time}`;
}

// The lead's next open task (earliest due), if any.
export function nextTask<T extends Pick<LeadTask, "lead_id" | "status" | "due_date" | "due_time">>(tasks: T[], leadId: string): T | null {
  const open = tasks.filter((t) => t.lead_id === leadId && t.status === "open");
  open.sort((a, b) => taskDueAt(a) - taskDueAt(b));
  return open[0] || null;
}

// Before the order: an open lead must have a task («har bir lid javobsiz qolmasin»).
export const needsTask = (col: CrmColumn | null) => col !== null && MANUAL_COLUMNS.includes(col);

export type BoardStats = { newToday: number; tasksToday: number; late: number; noTask: number };
export function boardStats(
  leads: Pick<Lead, "id" | "status" | "converted_order_id" | "created_at">[],
  tasks: Pick<LeadTask, "lead_id" | "status" | "due_date" | "due_time">[],
  orders: Record<string, Pick<Order, "status">>,
  now = Date.now(),
): BoardStats {
  const today = tashDay(now);
  const open = tasks.filter((t) => t.status === "open");
  const withTask = new Set(open.map((t) => t.lead_id));
  return {
    newToday: leads.filter((l) => tashDay(Date.parse(l.created_at)) === today).length,
    tasksToday: open.filter((t) => t.due_date === today).length,
    late: open.filter((t) => taskState(t, now) === "late").length,
    noTask: leads.filter((l) => needsTask(columnOf(l, orders)) && !withTask.has(l.id)).length,
  };
}

// amoCRM's select fields (amo-audit.yml, 2026-11-12), in Uzbek Latin.
export const ORDER_VOLUMES = ["Kichik buyurtma", "O'rtacha buyurtma", "Katta buyurtma"];
export const CUSTOMER_TYPES = ["Korporativ mijoz", "Yangi mijoz", "Doimiy mijoz", "Agent/Partnyor", "VIP mijoz"];
export const CRM_SOURCES = ["Instagram", "Telegram", "Facebook", "Reklama banneri", "Oflayn (ofisga kelgan)", "Telefon", "Tavsiya orqali"];
export const REGIONS = ["Andijon", "Buxoro", "Farg'ona", "Jizzax", "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", "Samarqand", "Sirdaryo", "Surxondaryo", "Toshkent"];
export const BUSINESS_TYPES = [
  "Qurilish", "Ta'lim", "Sog'liq", "Turizm", "Ishlab chiqarish", "Oziq-ovqat", "Chevarchilik", "Do'kon va magazin",
  "Telefon va aksessuarlar", "Mebel", "Ehtiyot qismlar (zapchast)", "Santexnika", "Distributsiya", "Rieltor",
];
export const PAYMENT_TYPES_CRM = ["Naqd", "Pul o'tkazma", "Click", "Ayirboshlash"];
export const PRODUCT_TYPES = [
  "Futbolka", "Kepka", "Kombo yozuv", "Flayer", "Buklet", "Liflet", "Ruchka", "Soft tach ruchka", "Sensor ruchka", "Kubarik",
  "Bloknot", "Koja bloknot", "Paket A4", "Paket A5", "Paket A2", "Bokal", "Soft tach bokal", "Soat", "Fartuk",
  "Ish stoli bayrog'i", "Sayohat bayrog'i", "Parus", "Roll-ap", "Pauchok", "Beydjik", "Finka standart", "Finka Lux",
  "Futbolka Amina", "Futbolka Status", "Futbolka Basico", "Rangli futbolka", "Gift Box", "Sayohat yostiqchasi",
  "Vizitka oddiy", "Vizitka Lux", "Sviter", "Xudi", "Kamzul", "Shopper", "Stiker pak", "Papka", "Doorhanger",
  "Kombo bloknot ruchka", "Standart set", "Ideal set", "Premium set",
];
// «Ёпилиш сабаби» — the same list, so reports stay comparable.
export const CRM_LOST_REASONS = [
  "Narx qimmat", "Sifat yoqmadi", "Raqobatchi tanlandi", "Aloqa yo'q", "Xato raqam", "Qadriyatimizga tushmadi",
  "Tavsiya orqali", "Taxi", "Ishxona raqami", "Buyurtma bekor bo'ldi",
];

// Task kinds on a lead; amoCRM had «Связаться» for almost all of them.
export const CRM_TASK_TYPES: { key: string; label: string; icon: string }[] = [
  { key: "call", label: "Qo'ng'iroq qilish", icon: "📞" },
  { key: "telegram", label: "Telegramdan yozish", icon: "✈" },
  { key: "send_price", label: "Narx / taklif yuborish", icon: "💬" },
  { key: "design_approval", label: "Maket tasdiqlatish", icon: "📐" },
  { key: "advance_reminder", label: "Avansni eslatish", icon: "💰" },
  { key: "follow_up", label: "Qayta aloqa", icon: "🔁" },
  { key: "other", label: "Boshqa", icon: "•" },
];
export const taskTypeInfo = (k: string) => CRM_TASK_TYPES.find((t) => t.key === k) || CRM_TASK_TYPES[CRM_TASK_TYPES.length - 1];

// Search across name, brand, phone digits and LID number.
export function matchesLead(l: Pick<Lead, "full_name" | "brand" | "phone" | "lead_number">, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const digits = s.replace(/\D/g, "");
  return (
    `${l.full_name} ${l.brand} ${l.lead_number || ""}`.toLowerCase().includes(s) ||
    (digits.length >= 3 && String(l.phone || "").replace(/\D/g, "").includes(digits))
  );
}
