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

// Sends a file (e.g. a generated PDF) with an optional caption / reply.
const sendDocument = async ({ chatId, threadId = null, buffer, filename, caption = "", replyTo = null }) => {
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  fd.append("document", new Blob([buffer], { type: "application/pdf" }), filename);
  if (threadId) fd.append("message_thread_id", String(threadId));
  if (caption) fd.append("caption", caption.slice(0, 1000));
  if (replyTo) fd.append("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error("Telegram sendDocument failed:", JSON.stringify(data));
  return data;
};

module.exports = { telegram, sendDocument, BOT_TOKEN };
