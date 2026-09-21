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

    // Guards against settling twice: the real 'change', the modern
    // 'cancel' event, and the focus-timeout fallback below can all fire
    // for the same pick, and only the first should count.
    let settled = false;
    const cleanup = () => {
      if (input.parentNode) document.body.removeChild(input);
    };
    const succeed = (file: File) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new SelfieCancelledError("Rasm tanlanmadi"));
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) succeed(file);
      // No file on change is rare; let the fallback below decide.
    };
    // Chrome/Android WebView fire a real 'cancel' event on the file
    // input when the picker/camera sheet is dismissed without a
    // selection — use it when available so cancellation is detected
    // immediately and correctly instead of guessed at.
    input.addEventListener("cancel", cancel);
    // Safari has no 'cancel' event, so fall back to a focus-return
    // check. The delay must be generous: on phones the tab regains
    // focus as soon as the camera app closes, but `onchange` (which
    // attaches the captured photo to `input.files`) can lag behind by
    // several seconds while the photo is encoded — a short delay here
    // false-positives as a cancel on a real capture, and since
    // `settled` latches, the later real success is silently dropped
    // (this is exactly what was happening: a real check-out selfie on
    // a slower device losing the race against a 3s timeout, so the
    // capture silently "cancelled" and the request never reached the
    // server at all). 8s gives slower devices/cameras enough room
    // while still cancelling promptly on a genuine dismissal.
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!settled && !input.files?.length) cancel();
        }, 8000);
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
