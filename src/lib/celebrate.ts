// «Yangi buyurtma» celebration (owner, 2026-11-27: «manager lidni
// buyurtmaga aylantirganda 3-4 soniyalik ovoz … Tabriklayman Muhammadiyor,
// yangi buyurtmangiz bilan, summaning KPI foizi … boshqalarga Muhammadiyor
// shunchalik buyurtma oldi deb chiqsin»; the KPI rate is the KPI page's).
// The seller who saves a new real order sees a dialog with the sound and
// confetti; everyone else gets a short toast from `celebrations/{id}`.

export type Celebration = {
  manager_name: string; // whose order (order.manager_name, else who saved it)
  created_by_email: string;
  created_by_name: string;
  customer: string;
  total: number;
  order_numbers: string[];
  order_id: string;
  created_at: string;
};

export const CELEBRATE_EVENT = "vp:celebrate";
export type CelebrateDetail = Celebration & { kpi: number; ratePct: number };

// The first word of a name: «Muhammaddiyor Abdullayev» → «Muhammaddiyor».
export const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "";

// The sales part of the KPI for this order (rate in %, e.g. 7.5), whole so'm.
export const kpiBonus = (total: number, ratePct: number) => Math.round((Math.max(0, Number(total) || 0) * Math.max(0, Number(ratePct) || 0)) / 100);

// Celebrate when an order turns real for the first time: a new order saved
// (not as a draft), or a draft (e.g. made from a lead) saved for real.
export const shouldCelebrate = (o: { asDraft: boolean; isNew: boolean; wasDraft: boolean; total: number }) => !o.asDraft && (o.isNew || o.wasDraft) && o.total > 0;

// Toasts shown only for fresh ones — not for what came before the page opened.
export const isFresh = (c: Pick<Celebration, "created_at">, since: string) => String(c.created_at) >= since;
