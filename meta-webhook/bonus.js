// KPI va bonus → Telegram. When the admin approves a manager's month on the
// site (kpi_months/{YYYY-MM}_{managerId}, status "approved"), the manager
// gets their bonus report in the bot's private chat; when it is marked
// "paid", a short "paid" note — only if the manager may see their KPI
// (the "KPI va bonus" permission). Each notice is claimed once in the document
// (notified_at / paid_notified_at), so restarts never send it twice, and
// only recent changes are sent, so a first start doesn't replay history.
const { telegram } = require("./telegram");

const FRESH_MS = 3 * 24 * 3600 * 1000;
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const PARTS = [
  ["plan", "Reja"],
  ["tasks", "Vazifalar"],
  ["attendance", "Davomat"],
  ["crm", "CRM tartibi"],
];

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/ |,/g, " ")} so'm`;
const monthName = (m) => `${MONTHS[Number(String(m).slice(5, 7)) - 1] || m} ${String(m).slice(0, 4)}`;
const fresh = (iso) => Boolean(iso) && Date.now() - Date.parse(iso) < FRESH_MS;
// 84.75 → "84,75", 41 → "41", 22.5 → "22,5".
const num = (n) => (n === null || n === undefined ? "—" : String(Math.round(Number(n) * 100) / 100).replace(".", ","));

const reportText = (k) => {
  const s = k.snapshot || {};
  const w = s.weights || {};
  const planPct = s.plan > 0 ? Math.round((s.turnover / s.plan) * 100) : null;
  const lines = [
    `🏆 ${monthName(k.month)} — bonus hisobotingiz`,
    "",
    `Oborot: ${money(s.turnover)}${planPct !== null ? ` (reja ${money(s.plan)}, ${planPct}%)` : ""}`,
    `Bonus fondi: ${money(s.fund)}`,
    "",
    `KPI ball: ${num(s.total)}%`,
    ...PARTS.map(([key, label]) => {
      const score = s.scores ? s.scores[key] : null;
      const pts = s.points ? s.points[key] : null;
      return score === null || score === undefined ? `• ${label}: hisobga olinmadi` : `• ${label}: ${Math.round(score)}% → ${num(pts)} / ${w[key] ?? "—"}`;
    }),
    "",
    `💰 To'lanadi: ${money(s.payout)}`,
  ];
  return lines.join("\n");
};

const create = (db) => {
  let unwatch = null;

  // Only accounts allowed to see their KPI (staff.permissions.kpi.view).
  const chatsOf = async (managerId) =>
    (await db.collection("staff").where("report_manager_id", "==", managerId).get()).docs
      .map((d) => d.data())
      .filter((s) => s.telegram_chat_id && s.permissions && s.permissions.kpi && s.permissions.kpi.view)
      .map((s) => s.telegram_chat_id);

  // Sets `field` unless already set; true if this call won.
  const claim = (ref, field) =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()[field]) return false;
      tx.update(ref, { [field]: new Date().toISOString() });
      return true;
    });

  const onChange = async (ref, k) => {
    if (k.status === "approved" && k.snapshot && fresh(k.approved_at) && !k.notified_at) {
      if (!(await claim(ref, "notified_at"))) return;
      for (const chat_id of await chatsOf(k.manager_id)) await telegram("sendMessage", { chat_id, text: reportText(k) });
    }
    if (k.status === "paid" && k.snapshot && fresh(k.paid_at) && !k.paid_notified_at) {
      if (!(await claim(ref, "paid_notified_at"))) return;
      for (const chat_id of await chatsOf(k.manager_id)) {
        await telegram("sendMessage", { chat_id, text: `✅ ${monthName(k.month)} bonusingiz to'landi: ${money(k.snapshot.payout)}` });
      }
    }
  };

  const start = () => {
    unwatch = db
      .collection("kpi_months")
      .where("status", "in", ["approved", "paid"])
      .onSnapshot(
        (snap) => {
          for (const ch of snap.docChanges()) {
            if (ch.type === "removed") continue;
            onChange(ch.doc.ref, ch.doc.data()).catch((err) => console.error("Bonus notice failed", ch.doc.id, err.message));
          }
        },
        (err) => console.error("Bonus listener error", err.message),
      );
    console.log("Bonus reports started");
  };
  const stop = () => unwatch && unwatch();

  return { start, stop, _test: { reportText, onChange } };
};

module.exports = { create, reportText };
