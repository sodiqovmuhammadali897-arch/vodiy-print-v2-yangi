import { logger } from "firebase-functions/v2";

const parseDataUrl = (dataUrl: string): { ext: string; buffer: Buffer } => {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Rasm formati noto'g'ri");
  }
  const [, ext, base64] = match;
  return { ext: ext === "jpg" ? "jpeg" : ext, buffer: Buffer.from(base64, "base64") };
};

// Posts the check-in/check-out selfie straight to the admin Telegram
// channel and nowhere else — the photo is never written to Firebase
// Storage, so Telegram is its only home. A delivery failure (bot not
// configured, network hiccup) is logged but never blocks the attendance
// record itself from being saved.
export const sendTelegramAttendancePhoto = async (
  caption: string,
  photoDataUrl: string,
): Promise<void> => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("Telegram bot not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing), skipping notification");
    return;
  }

  try {
    const { ext, buffer } = parseDataUrl(photoDataUrl);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("photo", new Blob([buffer], { type: `image/${ext}` }), `attendance.${ext}`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error("Telegram sendPhoto failed", { status: res.status, text });
    } else {
      // Success was previously silent, making it impossible to tell from
      // logs alone whether a report of "photo never arrived" is a real
      // delivery failure or the message landing somewhere the reporter
      // didn't check — log the chat_id and Telegram message_id so a
      // future report can be checked against this instead of guessed at.
      const body = (await res.json().catch(() => null)) as { result?: { message_id?: number } } | null;
      logger.info("Telegram sendPhoto ok", { chatId, messageId: body?.result?.message_id });
    }
  } catch (err) {
    logger.error("Telegram sendPhoto threw", { error: err });
  }
};
