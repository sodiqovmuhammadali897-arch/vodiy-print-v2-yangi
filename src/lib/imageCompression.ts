// Product photos are shown at small/medium sizes throughout the app (list
// thumbnails, detail header, customer price sheet) — there's no need to
// keep a phone camera's original resolution, so every upload is resized
// and re-encoded client-side before it's stored directly on the product
// document (data URI). This avoids needing Firebase Storage entirely,
// which would require the Blaze billing plan this project doesn't have.
const MAX_RAW_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

export const MAX_IMAGE_MB = MAX_RAW_BYTES / (1024 * 1024);

export const compressImageFile = (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Faqat rasm fayllari qabul qilinadi"));
  }
  if (file.size > MAX_RAW_BYTES) {
    return Promise.reject(new Error(`Fayl hajmi juda katta (maksimal ${MAX_IMAGE_MB}MB)`));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas mavjud emas"));
        return;
      }
      // Transparent pixels (a PNG logo, say) would otherwise turn black
      // once re-encoded as JPEG, since JPEG has no alpha channel.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
};
