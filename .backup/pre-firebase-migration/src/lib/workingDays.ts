import type { Holiday } from "./types";

const isSunday = (d: Date) => d.getDay() === 0;
const toKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const workingDaysBetween = (
  from: Date,
  to: Date,
  holidays: Holiday[] = [],
): number => {
  const holidaySet = new Set(holidays.map((h) => h.date));
  let a = startOfDay(from);
  let b = startOfDay(to);
  const sign = a > b ? -1 : 1;
  if (sign === -1) [a, b] = [b, a];
  let count = 0;
  const cursor = new Date(a);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= b) {
    if (!isSunday(cursor) && !holidaySet.has(toKey(cursor))) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return sign * count;
};

export type DeadlineInfo = {
  overdue: boolean;
  days: number;
  label: string;
  tone: "emerald" | "amber" | "rose" | "ink";
};

export const deadlineInfo = (
  deadline: string | null,
  holidays: Holiday[] = [],
  today: Date = new Date(),
): DeadlineInfo | null => {
  if (!deadline) return null;
  const target = new Date(deadline);
  if (isNaN(target.getTime())) return null;
  const days = workingDaysBetween(today, target, holidays);
  if (days < 0) {
    const overdue = -days;
    return {
      overdue: true,
      days: overdue,
      label: `Buyurtma ${overdue} ish kuni kechikdi`,
      tone: "rose",
    };
  }
  if (days === 0) {
    return { overdue: false, days: 0, label: "Bugun tayyor bo'lishi kerak", tone: "amber" };
  }
  return {
    overdue: false,
    days,
    label: `Tayyor bo'lishiga ${days} ish kuni qoldi`,
    tone: days <= 2 ? "amber" : "emerald",
  };
};
