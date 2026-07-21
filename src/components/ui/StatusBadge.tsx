import type { OrderStatus } from "../../lib/types";

const map: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: "Yangi", cls: "bg-sky-100 text-sky-700" },
  design: { label: "Dizaynda", cls: "bg-slate-100 text-slate-700" },
  approved: { label: "Tasdiqlangan", cls: "bg-brand-100 text-brand-700" },
  production: { label: "Ishlab chiqarish", cls: "bg-amber-100 text-amber-700" },
  done: { label: "Tugallangan", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Bekor qilingan", cls: "bg-rose-100 text-rose-700" },
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "new",
  "design",
  "approved",
  "production",
  "done",
  "cancelled",
];

export const orderStatusLabel = (s: OrderStatus) => map[s]?.label ?? s;

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const item = map[status] ?? map.new;
  return <span className={`chip ${item.cls}`}>{item.label}</span>;
}
