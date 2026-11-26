// Sotuv bo'limi → Kontaktlar (2026-11-26; the owner: «ishxona nomerlari,
// shaxsiy kontaktlarni kirgizib qo'ysak, u nomerlar zadacha yoki yangi
// lidlarga tushmasin»). A number on this list is not a lead: a call to or
// from it opens no lead, gets no task, is not «not returned» and does not
// count as sales talk time. Managers add them too; each shows who added it.
// Kept in crm_contacts/{id}; the server reads the same list
// (meta-webhook/contacts.js).
import type { CallRow } from "./crmDash";

export type ContactType = "office" | "staff" | "supplier" | "personal";
export type CrmContact = {
  id: string;
  name: string;
  phone: string;
  digits: string; // the last 9 digits — how calls are matched
  type: ContactType;
  note?: string;
  added_by_email: string;
  added_by_name: string;
  created_at: string;
  calls_count?: number; // written by the server on each matching call
  last_call_at?: string;
};

export const CONTACT_TYPES: { key: ContactType; label: string; icon: string; cls: string }[] = [
  { key: "office", label: "Ishxona", icon: "🏢", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" },
  { key: "staff", label: "Xodim", icon: "👤", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
  { key: "supplier", label: "Yetkazib beruvchi / kuryer", icon: "🚚", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
  { key: "personal", label: "Shaxsiy", icon: "🏠", cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" },
];
export const contactType = (k: string) => CONTACT_TYPES.find((t) => t.key === k) || CONTACT_TYPES[0];

export const phoneDigits = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-9);

// digits → contact, for matching calls.
export const contactIndex = (contacts: Pick<CrmContact, "digits" | "phone" | "name" | "type">[]) =>
  new Map(contacts.map((c) => [c.digits || phoneDigits(c.phone), c] as const).filter(([d]) => d.length === 9));

// A call with a contact's number, or null.
export function contactOfCall<T extends Pick<CrmContact, "name" | "type">>(c: Pick<CallRow, "phone">, index: Map<string, T>): T | null {
  const d = phoneDigits(c.phone);
  return d.length === 9 ? index.get(d) || null : null;
}

// Sales calls only: the contacts' calls left out.
export const salesCalls = <C extends Pick<CallRow, "phone">>(calls: C[], index: Map<string, unknown>) => (index.size ? calls.filter((c) => !index.has(phoneDigits(c.phone))) : calls);

// What a form needs before saving; "" = fine.
export function contactProblem(name: string, phone: string, existing: Pick<CrmContact, "digits" | "name" | "id">[], editingId = ""): string {
  if (!name.trim()) return "Ismini yozing";
  const d = phoneDigits(phone);
  if (d.length !== 9) return "Telefon raqamini to'liq yozing";
  const dup = existing.find((c) => c.digits === d && c.id !== editingId);
  return dup ? `Bu raqam allaqachon kontaktda: «${dup.name}»` : "";
}
