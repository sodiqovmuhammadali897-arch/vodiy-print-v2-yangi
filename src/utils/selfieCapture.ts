// Opens the device's camera via a hidden file input (works on iOS Safari
// and Android Chrome without getUserMedia/canvas video plumbing), then
// downsizes the shot to keep the Cloud Functions callable payload small.
const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.7;

export class SelfieCancelledError extends Error {}

const pickPhoto = (): Promise<File> =>
  new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "user");
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => document.body.removeChild(input);

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (file) resolve(file);
      else reject(new SelfieCancelledError("Rasm tanlanmadi"));
    };
    // No 'cancel' event exists for file inputs; a focus-return with no
    // file selected covers the user backing out of the camera sheet. The
    // delay must be generous: on phones the tab regains focus as soon as
    // the camera app closes, but `onchange` (which attaches the captured
    // photo to `input.files`) can lag behind by well over a second while
    // the photo is encoded — a short delay here false-positives as a
    // cancel on a real capture, and since the promise settles once,
    // `onchange`'s later resolve() is silently dropped.
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!input.files?.length) {
            cleanup();
            reject(new SelfieCancelledError("Rasm tanlanmadi"));
          }
        }, 1500);
      },
      { once: true },
    );

    input.click();
  });

const resizeToJpegDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas qo'llab-quvvatlanmaydi"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });

export const captureSelfie = async (): Promise<string> => {
  const file = await pickPhoto();
  return resizeToJpegDataUrl(file);
};
