// Which AI agents talk to Claude. Fewer agents, more results: by default
// the staff bot (prices and one's own data for employees) and the Bosh
// agent (daily plan check that hands out staff tasks) are on; the others
// stay off until listed in AI_AGENTS (comma-separated), e.g.
// AI_AGENTS=staffbot,bosh,hisobchi. The Telegram bot itself keeps working —
// task buttons, reminders, attendance and amoCRM notices don't use AI.

// The Instagram/Messenger agent uses no AI (fixed texts) — on by default
// since 2026-11-13; its replies still need Sozlamalar → Instagram «Yoqilgan».
const DEFAULT = "staffbot,bosh,instagram";
const NAMES = {
  hisobchi: "Hisobchi",
  marketolog: "Marketolog",
  bosh: "Bosh agent",
  targetolog: "Targetolog",
  kontent: "Kontent agenti",
  instagram: "Instagram Direct agenti",
  staffbot: "Xodimlar boti",
};

const enabled = () =>
  String(process.env.AI_AGENTS ?? DEFAULT)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const on = (name) => enabled().includes(name);
const offText = (name) => `${NAMES[name] || name} hozircha o'chirilgan.`;

module.exports = { on, offText, enabled, NAMES };
