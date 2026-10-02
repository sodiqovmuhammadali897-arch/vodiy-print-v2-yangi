export type DateRangePreset = "today" | "week" | "month" | "prev_month" | "year" | "custom";

export type DateRange = {
  preset: DateRangePreset;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd (inclusive)
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date): Date => {
  const out = new Date(d);
  const day = (out.getUTCDay() + 6) % 7; // Monday = 0
  out.setUTCDate(out.getUTCDate() - day);
  return out;
};

// Days are Tashkent days (UTC+5), like inRange below. The UTC getters of a
// shifted Date give the Tashkent calendar whatever the browser's clock zone.
const tashkentNow = (now: Date): Date => new Date(now.getTime() + 5 * 3600 * 1000);
const ymd = (y: number, m: number, d: number): string => toISODate(new Date(Date.UTC(y, m, d)));

export const presetRange = (preset: DateRangePreset, now: Date = new Date()): { from: string; to: string } => {
  const t = tashkentNow(now);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const today = toISODate(t);
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: toISODate(startOfWeek(t)), to: today };
  if (preset === "month") return { from: ymd(y, m, 1), to: today };
  // Day 0 of a month is the last day of the one before it.
  if (preset === "prev_month") return { from: ymd(y, m - 1, 1), to: ymd(y, m, 0) };
  if (preset === "year") return { from: ymd(y, 0, 1), to: today };
  return { from: today, to: today };
};

export const defaultDateRange = (): DateRange => ({
  preset: "month",
  ...presetRange("month"),
});

// Half-open [from, toExclusive) ISO-datetime bounds for filtering created_at
// style timestamp strings against a yyyy-mm-dd "to" (inclusive) date.
export const rangeBounds = (range: DateRange): { fromISO: string; toISO: string } => {
  const fromISO = `${range.from}T00:00:00.000Z`;
  const toDate = new Date(`${range.to}T00:00:00.000Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  return { fromISO, toISO: toDate.toISOString() };
};

// A plain date ("2026-09-01", like an order's Sana) is compared as a day —
// comparing it to a timestamp bound used to drop the range's first day —
// and a timestamp by its Tashkent day.
export const inRange = (isoDateOrDatetime: string | null | undefined, range: DateRange): boolean => {
  if (!isoDateOrDatetime) return false;
  const v = String(isoDateOrDatetime);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date(Date.parse(v) + 5 * 3600 * 1000).toISOString().slice(0, 10);
  return day >= range.from && day <= range.to;
};

// Returns the immediately preceding period of equal length, for
// period-over-period growth comparisons.
export const previousPeriod = (range: DateRange): DateRange => {
  // A whole month compares with the whole month before it, not with the
  // last 30 days of it.
  if (range.preset === "prev_month") {
    const [y, m] = range.from.split("-").map(Number);
    return { preset: "custom", from: ymd(y, m - 2, 1), to: ymd(y, m - 1, 0) };
  }
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T00:00:00.000Z`);
  const spanMs = to.getTime() - from.getTime() + 24 * 60 * 60 * 1000;
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs + 24 * 60 * 60 * 1000);
  return {
    preset: "custom",
    from: toISODate(prevFrom),
    to: toISODate(prevTo),
  };
};

export const growthPercent = (current: number, previous: number): number | null => {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Buckets a range into day keys (yyyy-mm-dd) for simple charts. Caps at 62
// points so a full-year selection still renders as a readable chart.
export const dayBuckets = (range: DateRange): string[] => {
  const out: string[] = [];
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T00:00:00.000Z`);
  const cursor = new Date(from);
  let guard = 0;
  while (cursor <= to && guard < 400) {
    out.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return out;
};
