export type DateRangePreset = "today" | "week" | "month" | "year" | "custom";

export type DateRange = {
  preset: DateRangePreset;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd (inclusive)
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date): Date => {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - day);
  return out;
};

export const presetRange = (preset: DateRangePreset): { from: string; to: string } => {
  const now = new Date();
  const today = toISODate(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: toISODate(startOfWeek(now)), to: today };
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(start), to: today };
  }
  if (preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: toISODate(start), to: today };
  }
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

export const inRange = (isoDateOrDatetime: string | null | undefined, range: DateRange): boolean => {
  if (!isoDateOrDatetime) return false;
  const { fromISO, toISO } = rangeBounds(range);
  return isoDateOrDatetime >= fromISO && isoDateOrDatetime < toISO;
};

// Returns the immediately preceding period of equal length, for
// period-over-period growth comparisons.
export const previousPeriod = (range: DateRange): DateRange => {
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
