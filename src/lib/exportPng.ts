import html2canvas from "html2canvas";

// PNGs go to customers (usually over Telegram), so small text and thin
// fonts must stay crisp when they zoom in. Aim for a ~3600px-wide image
// (roughly a 300 DPI A4 page, a few MB) instead of a fixed 3× scale, which
// left narrow documents at ~2400px and soft-looking text.
const TARGET_WIDTH_PX = 3600;
const MAX_SCALE = 6;
// iOS Safari refuses to allocate a canvas above ~16.7M pixels and silently
// produces a blank image instead — long documents get scaled down just
// enough to stay under it rather than failing.
const MAX_CANVAS_PIXELS = 16_000_000;

export const captureHighResCanvas = async (node: HTMLElement): Promise<HTMLCanvasElement> => {
  // Capturing before web fonts finish loading makes html2canvas fall back
  // to a system font with different metrics — text sits at different
  // widths than what's on screen, which can even push flex-wrapped content
  // onto a different line than the live page shows.
  await document.fonts.ready;
  const width = Math.max(1, node.scrollWidth || node.offsetWidth);
  const height = Math.max(1, node.scrollHeight || node.offsetHeight);
  const scale = Math.max(
    1,
    Math.min(MAX_SCALE, TARGET_WIDTH_PX / width, Math.sqrt(MAX_CANVAS_PIXELS / (width * height))),
  );
  return html2canvas(node, { scale, useCORS: true, backgroundColor: "#ffffff" });
};

// A multi-megabyte image as a data: URL can fail to download in some
// browsers (Safari especially); a Blob object URL has no such size limit.
export const downloadCanvasPng = (canvas: HTMLCanvasElement, fileBase: string): Promise<void> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Rasmni yaratib bo'lmadi"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${fileBase}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      resolve();
    }, "image/png");
  });

export const exportNodeToPng = async (node: HTMLElement, fileBase: string): Promise<void> => {
  const canvas = await captureHighResCanvas(node);
  await downloadCanvasPng(canvas, fileBase);
};
