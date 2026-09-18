import { randomUUID } from "crypto";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // client already downsizes to ~a few hundred KB

// Selfies are archival only (no facial-recognition matching), stored with a
// Firebase download token so the admin attendance table can show them
// without needing separate Storage security rules — the Admin SDK already
// bypasses those, same as every other attendance write.
export const uploadAttendancePhoto = async (
  email: string,
  dateCode: string,
  kind: "checkin" | "checkout",
  dataUrl: string,
): Promise<string> => {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new HttpsError("invalid-argument", "Rasm formati noto'g'ri");
  }
  const [, ext, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new HttpsError("invalid-argument", "Rasm hajmi juda katta");
  }

  const bucket = getStorage().bucket();
  const token = randomUUID();
  const path = `attendance_photos/${email}/${dateCode}_${kind}_${Date.now()}.${ext === "jpg" ? "jpeg" : ext}`;
  const file = bucket.file(path);

  await file.save(buffer, {
    metadata: {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
};
