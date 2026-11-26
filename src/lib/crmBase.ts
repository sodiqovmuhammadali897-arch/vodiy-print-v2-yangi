// Mijozlar bazasi (Sotuv bo'limi, 2026-11-26): the rules of the page —
// groups, filters, counts and what «Qayta ishlash» writes. Data comes from
// crm_base (meta-webhook/crmBase.js).
import type { BaseCall, BaseDeal, CrmBaseDoc } from "./types";

export const digitsOf = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-9);

// The loss groups (as meta-webhook/amoLost.js) + won, in the page's order.
export const BASE_GROUPS: { key: string; label: string; hint: string; tone: string; cls: string }[] = [
  { key: "price", label: "Narx qimmat", hint: "qayta taklif", tone: "text-rose-600 dark:text-rose-300", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200" },
  { key: "competitor", label: "Raqobatchi", hint: "keyingi buyurtma", tone: "text-amber-600 dark:text-amber-300", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  { key: "no_answer", label: "Aloqa yo'q", hint: "qayta qo'ng'iroq", tone: "text-ink-900", cls: "bg-ink-100 text-ink-700" },
  { key: "cancelled", label: "Bekor bo'ldi", hint: "so'rash kerak", tone: "text-ink-900", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200" },
  { key: "won", label: "Yutilgan", hint: "takroriy savdo", tone: "text-emerald-600 dark:text-emerald-300", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" },
  { key: "other", label: "Boshqa sabab", hint: "", tone: "text-ink-900", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200" },
  { key: "none", label: "Sababsiz", hint: "", tone: "text-ink-900", cls: "bg-ink-100 text-ink-600" },
  { key: "wrong_number", label: "Xato raqam", hint: "", tone: "text-ink-900", cls: "bg-ink-100 text-ink-500" },
];
export const groupInfo = (k: string) => BASE_GROUPS.find((g) => g.key === k) || BASE_GROUPS[5];
export const dealLabel = (d: Pick<BaseDeal, "status" | "reason" | "group">) => (d.status === "won" ? "Yutilgan" : d.reason || groupInfo(d.group).label);

export type BaseFilter = { q: string; group: string; source: "" | "amo" | "erp"; manager: string; year: string; fresh: boolean };
export const EMPTY_FILTER: BaseFilter = { q: "", group: "", source: "", manager: "", year: "", fresh: false };

export function matchesBase(c: CrmBaseDoc, f: BaseFilter): boolean {
  if (f.group && c.last?.group !== f.group) return false;
  if (f.source && !c.deals.some((d) => d.source === f.source)) return false;
  if (f.manager && (c.last?.manager_name || "") !== f.manager) return false;
  if (f.year && !String(c.last?.closed_at || "").startsWith(f.year)) return false;
  if (f.fresh && c.reopened?.count) return false;
  const s = f.q.trim().toLowerCase();
  if (!s) return true;
  const d = s.replace(/\D/g, "");
  return (
    (d.length >= 3 && c.digits.includes(d)) ||
    [c.name, c.brand, c.region, ...c.deals.map((x) => x.product)].some((v) => String(v || "").toLowerCase().includes(s))
  );
}

// Newest closed first.
export const sortBase = (list: CrmBaseDoc[]) => [...list].sort((a, b) => String(b.last?.closed_at || "").localeCompare(String(a.last?.closed_at || "")));

export function baseCounts(list: CrmBaseDoc[]): Record<string, number> {
  const out: Record<string, number> = { all: list.length };
  for (const c of list) out[c.last?.group || "none"] = (out[c.last?.group || "none"] || 0) + 1;
  return out;
}

export const baseManagers = (list: CrmBaseDoc[]) => [...new Set(list.map((c) => c.last?.manager_name || "").filter(Boolean))].sort();
export const baseYears = (list: CrmBaseDoc[]) => [...new Set(list.map((c) => String(c.last?.closed_at || "").slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse();

// The history to show on a lead card: the base's deals of that phone, but
// not the lead's own (an ERP lead lost and reopened is already this lead).
export const historyFor = (doc: CrmBaseDoc | null, leadId: string) => (doc?.deals || []).filter((d) => d.lead_id !== leadId);

// The new lead «Qayta ishlash» opens, and its note. Pure.
export function reopenFields(c: CrmBaseDoc) {
  const last = c.deals[0];
  const products = [...new Set(c.deals.map((d) => d.product).filter(Boolean))].join(", ");
  const history = c.deals
    .slice(0, 3)
    .map((d) => `${String(d.closed_at).slice(0, 10)} ${dealLabel(d)}${d.manager_name ? ` (${d.manager_name})` : ""}`)
    .join("; ");
  return {
    full_name: c.name || "",
    brand: c.brand || "",
    phone: c.phone,
    region: c.region || "",
    industry: c.industry || "",
    address: c.address || "",
    interested_product_name: products,
    estimated_amount: c.sum || 0,
    source: "Mijozlar bazasi",
    status: "accepted" as const,
    note: `Mijozlar bazasidan qayta ishlash. Oldin: ${history}`,
    taskNote: last ? (last.status === "won" ? "Takroriy buyurtma taklif qiling" : `Qayta taklif — oldin «${dealLabel(last)}»`) : "Qayta taklif",
  };
}

export const csvRows = (list: CrmBaseDoc[]) =>
  list.map((c) => [c.name || "", c.brand || "", c.phone, c.region || "", dealLabel({ status: c.last?.status as "won" | "lost", reason: c.last?.reason || "", group: c.last?.group || "" }), String(c.last?.closed_at || "").slice(0, 10), c.last?.manager_name || "", [...new Set(c.deals.map((d) => d.product).filter(Boolean))].join("; "), c.sum || 0, c.deals.length, c.reopened?.count || 0]);
export const CSV_HEADERS = ["Ism", "Brend", "Telefon", "Viloyat", "Oxirgi natija", "Yopilgan", "Manager", "Mahsulot", "Summa", "Bitimlar", "Qayta ishlangan"];

// The customer's calls: amoCRM's (in the base) + the ERP's own `calls` of
// that phone, newest first, one per call (the same Mois Zvonki call may be
// in both — same minute, same direction → kept once, the one with audio).
export type ErpCallRow = { id: string; direction?: string; answered?: boolean; duration_seconds?: number; recording_url?: string; start_time?: string | null; created_at?: string; staff_name?: string; staff_email?: string; contact?: unknown };
export function mergeCalls(amo: BaseCall[] = [], erp: ErpCallRow[] = []): BaseCall[] {
  const out: BaseCall[] = [...amo];
  const key = (c: { at: string; dir: string }) => `${c.dir}:${String(c.at).slice(0, 16)}`;
  const have = new Map(out.map((c) => [key(c), c]));
  for (const r of erp) {
    const c = { id: `erp:${r.id}`, at: r.start_time || r.created_at || "", dir: (r.direction === "in" ? "in" : "out") as "in" | "out", sec: Number(r.duration_seconds) || 0, who: r.staff_name || r.staff_email || "", link: r.recording_url || "", src: "erp" as const, answered: r.answered };
    const same = have.get(key(c));
    if (same) {
      if (!same.link && c.link) same.link = c.link;
      continue;
    }
    have.set(key(c), c);
    out.push(c);
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// The forms a phone is kept in `calls.phone` (Mois Zvonki sends it as typed).
export const phoneForms = (digits: string, raw = "") => [...new Set([digits, `998${digits}`, `+998${digits}`, raw].filter((x) => x && x.length >= 9))];

export const secLabel = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} daq ${s % 60} s` : `${s} s`);
