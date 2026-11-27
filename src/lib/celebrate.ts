// «Yangi buyurtma» celebration (owner, 2026-11-27: «manager lidni
// buyurtmaga aylantirganda 3-4 soniyalik ovoz … Tabriklayman Muhammadiyor,
// yangi buyurtmangiz bilan, summaning KPI foizi … boshqalarga Muhammadiyor
// shunchalik buyurtma oldi deb chiqsin»; the KPI rate is the KPI page's).
// Whoever saves a new real order — a seller or the owner/an admin — sees a
// dialog with the sound and confetti; the order's manager gets it too when
// someone else typed it; everyone else gets a short toast (`celebrations`).

export type Celebration = {
  manager_name: string; // whose order (order.manager_name, else who saved it)
  created_by_email: string;
  created_by_name: string;
  customer: string;
  total: number;
  order_numbers: string[];
  order_id: string;
  created_at: string;
  // The order's manager (Managerlar id) and their KPI part — so that manager
  // gets the full dialog even when an admin typed the order (2026-11-27).
  manager_id?: string;
  kpi?: number;
  rate_pct?: number;
};

export const CELEBRATE_EVENT = "vp:celebrate";
// `mine`: the one who saved it is the order's seller («Tabriklayman, X!»);
// otherwise (the owner/an admin typed it) «X yangi buyurtma oldi».
export type CelebrateDetail = Celebration & { kpi: number; ratePct: number; mine: boolean; hasManager: boolean };

// The order's manager: by manager_name (as KPI counts orders), else the
// saver's own Managerlar record when the order names nobody.
export function orderManagerOf<M extends { id: string; name: string }>(managers: M[], managerName: string, actorManagerId: string | null | undefined): M | null {
  const n = String(managerName || "").trim().toLowerCase();
  if (n) return managers.find((m) => String(m.name || "").trim().toLowerCase() === n) || null;
  return actorManagerId ? managers.find((m) => m.id === actorManagerId) || null : null;
}

// The first word of a name: «Muhammaddiyor Abdullayev» → «Muhammaddiyor».
export const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "";

// The sales part of the KPI for this order (rate in %, e.g. 7.5), whole so'm.
export const kpiBonus = (total: number, ratePct: number) => Math.round((Math.max(0, Number(total) || 0) * Math.max(0, Number(ratePct) || 0)) / 100);

// Celebrate when an order turns real for the first time: a new order saved
// (not as a draft), or a draft (e.g. made from a lead) saved for real.
export const shouldCelebrate = (o: { asDraft: boolean; isNew: boolean; wasDraft: boolean; total: number }) => !o.asDraft && (o.isNew || o.wasDraft) && o.total > 0;

// Toasts shown only for fresh ones — not for what came before the page opened.
export const isFresh = (c: Pick<Celebration, "created_at">, since: string) => String(c.created_at) >= since;
