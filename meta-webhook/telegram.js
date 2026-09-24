// Bot API helper shared by the Hisobchi bot and the HR agent.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const telegram = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error(`Telegram ${method} failed:`, JSON.stringify(data));
  return data;
};

module.exports = { telegram, BOT_TOKEN };
