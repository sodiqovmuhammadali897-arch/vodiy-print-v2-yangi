import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const capture = async (node: HTMLElement) => {
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
};

export const exportProposalPng = async (node: HTMLElement, fileBase: string) => {
  const canvas = await capture(node);
  const link = document.createElement("a");
  link.download = `${fileBase}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

// Slices the captured canvas into A4-height chunks and adds one PDF page
// per chunk, instead of squeezing the whole document onto a single
// shrunk page — a proposal with many line items should paginate like a
// real document, not become unreadably small.
export const exportProposalPdf = async (node: HTMLElement, fileBase: string) => {
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

  pdf.save(`${fileBase}.pdf`);
};
