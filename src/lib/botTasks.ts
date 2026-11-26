// Xodimlar → «Bot unga nima bersin» (the owner, 2026-11-24: «doim sanga
// qandaydir managerga buyruqlar beryapman, shuni xodimlar ruxsatiga
// belgidan qil»). Saved on staff.bot_tasks; the server reads it in
// meta-webhook/botTasks.js (recall.js, debts.js, leadClaim.js, amocrm.js).
export type BotTasks = {
  recall: boolean; // old customers, one at a time
  recall_per_day: number;
  debts: boolean; // debtors list
  leads: boolean; // may take a new lead with «✅ Qabul qildim»
  amo: boolean; // amoCRM reminders in Telegram
  tasks: boolean; // ERP lead tasks: a Telegram reminder when one is due (2026-11-26)
};

export const RECALL_PER_DAY_DEFAULT = 20;

// A missing field: as the server treats a staff member nobody ticked yet.
export const botTasksOf = (s: { bot_tasks?: Partial<BotTasks> | null } | null | undefined): BotTasks => {
  const bt = (s && s.bot_tasks) || {};
  const n = Number(bt.recall_per_day);
  return {
    recall: bt.recall === true,
    recall_per_day: n > 0 ? Math.min(200, Math.round(n)) : RECALL_PER_DAY_DEFAULT,
    debts: bt.debts === true,
    leads: bt.leads !== false,
    amo: bt.amo !== false,
    tasks: bt.tasks === true,
  };
};

export const BOT_TASK_ROWS: { key: "recall" | "debts" | "leads" | "amo" | "tasks"; label: string; hint: string; chip: string; cls: string }[] = [
  { key: "recall", label: "Eski mijozlar (bittadan)", hint: "09:00–19:00 bitta mijoz beriladi; natijani belgilasa — keyingisi keladi.", chip: "Eski mijoz", cls: "bg-brand-50 text-brand-700" },
  { key: "debts", label: "Qarzdor mijozlar", hint: "O'z buyurtmalari bo'yicha qarzi bor mijozlar ro'yxati, har kuni.", chip: "Qarzdorlar", cls: "bg-rose-50 text-rose-700" },
  { key: "leads", label: "Yangi lidlar", hint: "Guruhdagi yangi lidni «✅ Qabul qildim» bilan o'ziga ola oladi. Belgisi yo'q xodim bossa — «belgilanmagan» deydi.", chip: "Lidlar", cls: "bg-emerald-50 text-emerald-700" },
  { key: "tasks", label: "Zadacha eslatmalari (ERP)", hint: "Lid zadachasi vaqti kelganda Telegram'ga xabar: 📞 Gaplashdim · 📵 Javob bermadi · ⏰ +1 soat · 📅 Ertaga. 30 daqiqa o'tsa — yana bir marta.", chip: "Zadachalar", cls: "bg-amber-50 text-amber-800" },
  { key: "amo", label: "Kunlik eslatmalar (amoCRM / ERP)", hint: "Telegram'ga: 09:00 zadachalar, 10:00 va 15:00 zadachasiz lidlar, 18:00 qolganlari. Asosiy tizim qaysi bo'lsa (Tahlil → «amoCRM → ERP»), o'shandan.", chip: "Kunlik", cls: "bg-violet-50 text-violet-700" },
];
