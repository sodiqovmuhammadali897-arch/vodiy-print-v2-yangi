import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const capture = async (node: HTMLElement) => {
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
};

// Slices the captured canvas into A4-height chunks and adds one PDF page per
// chunk, instead of squeezing the whole document onto a single shrunk page —
// a document with many rows should paginate like a real document.
export const htmlToPdf = async (node: HTMLElement): Promise<jsPDF> => {
  const canvas = await capture(node);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageWidthMm;
  const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);

  let renderedPx = 0;
  let isFirstPage = true;
  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    if (!isFirstPage) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      pageWidthMm,
      sliceHeightPx / pxPerMm,
    );

    renderedPx += sliceHeightPx;
    isFirstPage = false;
  }

  return pdf;
};

export const htmlToPng = async (node: HTMLElement): Promise<string> => {
  const canvas = await capture(node);
  return canvas.toDataURL("image/png");
};
