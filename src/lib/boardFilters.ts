import { needsTask, taskState, type CrmColumn } from "./crm";
import type { LeadTask } from "./types";

// Sotuv bo'limi → Jarayon, the calm amoCRM-like board (2026-11-28, the owner:
// «amoda tepada turgan bugungi zadacha, o'tib ketganlarni belgisa chiqadi»).
// The numbers in the top strip count LEADS, so pressing one shows exactly
// that many cards.
export type BoardFilter = "" | "today" | "late" | "notask" | "new";

export type BoardRow = {
  created_at: string;
  col: CrmColumn | null;
  next: Pick<LeadTask, "due_date" | "due_time"> | null;
};

const tashDay = (ms: number) => new Date(ms + 5 * 3600e3).toISOString().slice(0, 10);

export function rowFlags(r: BoardRow, now = Date.now()) {
  const st = r.next ? taskState(r.next, now) : null;
  const created = tashDay(Date.parse(r.created_at));
  return {
    today: st === "today",
    late: st === "late",
    notask: !r.next && needsTask(r.col),
    newToday: created === tashDay(now),
    newYesterday: created === tashDay(now - 86400000),
  };
}

export function passes(filter: BoardFilter, r: BoardRow, now = Date.now()): boolean {
  if (!filter) return true;
  const f = rowFlags(r, now);
  if (filter === "new") return f.newToday || f.newYesterday;
  return f[filter];
}

export function boardCounts(rows: BoardRow[], now = Date.now()) {
  const c = { today: 0, late: 0, notask: 0, newToday: 0, newYesterday: 0 };
  for (const r of rows) {
    const f = rowFlags(r, now);
    for (const k of Object.keys(c) as (keyof typeof c)[]) if (f[k]) c[k]++;
  }
  return c;
}

// A card's date: «Bugun 12:22», «Kecha 19:10», else «26.11» (this year) or «26.11.2025».
export function cardDate(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const t = new Date(ms + 5 * 3600e3).toISOString();
  const day = t.slice(0, 10);
  const hm = t.slice(11, 16);
  if (day === tashDay(now)) return `Bugun ${hm}`;
  if (day === tashDay(now - 86400000)) return `Kecha ${hm}`;
  const dm = `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  return day.slice(0, 4) === tashDay(now).slice(0, 4) ? dm : `${dm}.${day.slice(0, 4)}`;
}
