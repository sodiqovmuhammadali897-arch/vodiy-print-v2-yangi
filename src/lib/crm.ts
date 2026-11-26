// The ERP's own CRM (the owner's request, 2026-11-12: «amoCRM'day»):
// the same stages and lead fields as the team's amoCRM (read with
// amo-audit.yml), tasks with a deadline and a required result, and the
// rules the board highlights (a late task, an open lead with no task).
// Pure helpers here; the pages are src/modules/leads/crm/*.
import type { Lead, LeadStatus, LeadTask, Order, OrderStatus } from "./types";

// The day the ERP's CRM started. The 133 leads from the first version
// (all still «new», untouched since) stay hidden unless asked for.
export const CRM_START = "2026-11-12";
// Leads moved over from amoCRM (step 4, `amo_id`) keep their real date and
// are never «old».
export const isOldLead = (l: { created_at: string; amo_id?: number | null }) => !l.amo_id && String(l.created_at || "") < CRM_START;

// A stage's key: the built-in ones below, or one the owner added in Sotuv
// bo'limi → Sozlamalar (2026-11-26; crmSettings.ts applies the saved order,
// names and colours to these lists at run time).
export type CrmColumn = string;
export const ORDER_STAGE_KEYS = ["advance", "production", "delivered"];
export const BUILTIN_MANUAL_KEYS = ["new", "accepted", "info_given", "offer"];

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
export const MANUAL_COLUMNS: CrmColumn[] = [...BUILTIN_MANUAL_KEYS];
export const DEFAULT_STAGES = CRM_COLUMNS.map((c) => ({ ...c }));

// The owner's saved stages → CRM_COLUMNS and MANUAL_COLUMNS (in place, so
// every importer sees them): «Yangi» first, then the manual ones in the
// saved order (the built-in ones always kept), then the three that follow
// the order — their names and colours only.
export function applyStages(saved?: { key: string; label?: string; color?: string }[] | null) {
  const base = new Map(DEFAULT_STAGES.map((c) => [c.key, c]));
  const list = (saved || []).filter((x) => x && x.key);
  const pick = (k: string) => {
    const x = list.find((y) => y.key === k) || base.get(k) || { key: k, label: k, color: "#94a3b8" };
    return { key: k, label: String(x.label || base.get(k)?.label || k), color: String(x.color || base.get(k)?.color || "#94a3b8") };
  };
  const manual = list.map((x) => x.key).filter((k) => k !== "new" && !ORDER_STAGE_KEYS.includes(k));
  for (const k of BUILTIN_MANUAL_KEYS) if (k !== "new" && !manual.includes(k)) manual.push(k);
  const keys = ["new", ...new Set(manual)];
  CRM_COLUMNS.splice(0, CRM_COLUMNS.length, ...keys.map(pick), ...ORDER_STAGE_KEYS.map(pick));
  MANUAL_COLUMNS.splice(0, MANUAL_COLUMNS.length, ...keys);
}

const fromOrder = (s: OrderStatus): CrmColumn => {
  if (s === "sent_to_production" || s === "production" || s === "quality_control" || s === "ready" || s === "ready_to_deliver") return "production";
  if (s === "delivered" || s === "closed") return "delivered";
  return "advance";
};

// Where a lead sits on the board; null = lost or its order was cancelled.
export function columnOf(lead: Pick<Lead, "status" | "converted_order_id">, orders: Record<string, Pick<Order, "status">>): CrmColumn | null {
  const s: string = lead.status as LeadStatus;
  if (s === "lost") return null;
  if (lead.converted_order_id) {
    const o = orders[lead.converted_order_id];
    if (!o) return "advance";
    if (o.status === "cancelled") return null;
    return fromOrder(o.status);
  }
  if (s === "telegram") return "info_given"; // the first version's stage
  if (MANUAL_COLUMNS.includes(s)) return s;
  // the first version's later stages (design, production …) without an order
  if (["advance", "design", "production", "ready", "delivered"].includes(s)) return "advance";
  return "accepted"; // a stage that was removed
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

// Zadachalar's four columns (step 3, 2026-11-26), like amoCRM's task page.
export type TaskColumn = "late" | "today" | "tomorrow" | "later";
export const TASK_COLUMNS: { key: TaskColumn; label: string; color: string }[] = [
  { key: "late", label: "Muddati o'tgan", color: "#e11d48" },
  { key: "today", label: "Bugun", color: "#16a34a" },
  { key: "tomorrow", label: "Ertaga", color: "#0ea5e9" },
  { key: "later", label: "Keyinroq", color: "#94a3b8" },
];
export function taskColumn(t: Pick<LeadTask, "due_date" | "due_time">, now = Date.now()): TaskColumn {
  const s = taskState(t, now);
  if (s !== "later") return s;
  return t.due_date === tashDay(now + 86400000) ? "tomorrow" : "later";
}

// Moving a task: «+1 soat» from now, or tomorrow 10:00 (the same as the
// Telegram reminder's buttons, meta-webhook/leadTaskBot.js).
export function snoozeSlot(kind: "h1" | "tomorrow", now = Date.now()): { date: string; time: string } {
  if (kind === "tomorrow") return { date: tashDay(now + 86400000), time: "10:00" };
  const t = new Date(now + 3600e3 + 5 * 3600e3).toISOString();
  return { date: t.slice(0, 10), time: t.slice(11, 16) };
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
export const DEFAULT_TASK_TYPES = CRM_TASK_TYPES.map((t) => ({ ...t }));
export const taskTypeInfo = (k: string) => CRM_TASK_TYPES.find((t) => t.key === k) || DEFAULT_TASK_TYPES.find((t) => t.key === k) || { key: k, label: k === "other" ? "Boshqa" : "Zadacha", icon: "•" };
// The owner's task types (Sozlamalar) → CRM_TASK_TYPES, in place.
export function applyTaskTypes(saved?: { key: string; label?: string; icon?: string }[] | null) {
  const list = (saved || []).filter((x) => x && x.key && x.label);
  CRM_TASK_TYPES.splice(0, CRM_TASK_TYPES.length, ...(list.length ? list.map((x) => ({ key: x.key, label: String(x.label), icon: String(x.icon || "•") })) : DEFAULT_TASK_TYPES.map((t) => ({ ...t }))));
}

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
