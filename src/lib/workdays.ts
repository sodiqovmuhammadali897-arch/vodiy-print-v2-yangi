import type { Holiday } from "./types";

export type WorkdayStats = {
  totalDays: number;
  workDays: number;
  workDaysPassed: number;
  workDaysLeft: number;
  monthName: string;
  monthNumber: number;
  year: number;
};

const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

const isSunday = (d: Date) => d.getDay() === 0;

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const computeWorkdayStats = (
  today: Date,
  holidays: Holiday[] = [],
): WorkdayStats => {
  const year = today.getFullYear();
  const month = today.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const holidaySet = new Set(holidays.map((h) => h.date));

  let workDays = 0;
  let workDaysPassed = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const isHoliday = holidaySet.has(toDateKey(d));
    const isWork = !isSunday(d) && !isHoliday;
    if (isWork) {
      workDays++;
      if (day <= today.getDate()) workDaysPassed++;
    }
  }

  return {
    totalDays,
    workDays,
    workDaysPassed,
    workDaysLeft: Math.max(0, workDays - workDaysPassed),
    monthName: UZ_MONTHS[month],
    monthNumber: month + 1,
    year,
  };
};

export const monthRange = (today: Date) => {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const startOfDay = (today: Date): Date =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate());
