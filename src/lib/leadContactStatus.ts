export type ContactTone = "overdue" | "today" | "upcoming";

// Buckets a lead's next_contact_at for the little chip shown on its
// Kanban card / list row — "overdue" once the day has passed, "today"
// for anything still due today regardless of time, "upcoming" after.
export const contactTone = (iso: string | null): ContactTone | null => {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  if (target < todayStart) return "overdue";
  if (target < todayEnd) return "today";
  return "upcoming";
};

export const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" });
};
