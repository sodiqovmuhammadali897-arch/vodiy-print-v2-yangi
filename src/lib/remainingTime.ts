export type RemainingTime = {
  label: string;
  overdue: boolean;
  days: number;
  hours: number;
};

// A plain calendar countdown to the deadline (not the working-days count
// used elsewhere) — date-only deadlines are treated as ending at 23:59 so
// "bugun" still shows a meaningful hour count instead of going negative
// at midnight.
export const remainingTimeLabel = (
  deadline: string | null,
  now: Date = new Date(),
): RemainingTime | null => {
  if (!deadline) return null;
  const target = new Date(deadline);
  if (isNaN(target.getTime())) return null;
  if (deadline.length === 10) target.setHours(23, 59, 59, 999);

  const diffMs = target.getTime() - now.getTime();
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / (24 * 3600 * 1000));
  const hours = Math.floor((abs % (24 * 3600 * 1000)) / (3600 * 1000));

  return {
    label: `${days}-kun ${hours}-soat ${overdue ? "kechikdi" : "qoldi"}`,
    overdue,
    days,
    hours,
  };
};
