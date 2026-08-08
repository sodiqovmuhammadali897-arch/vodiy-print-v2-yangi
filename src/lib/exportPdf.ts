import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const exportNodeToPdf = async (node: HTMLElement, fileBase: string): Promise<void> => {
  // Exported PDFs are always meant to read as a plain document, regardless
  // of the app's current theme — capturing a dark-mode page onto the
  // forced-white canvas background below would otherwise render light text
  // as invisible. Dropping .dark for the capture reverts every CSS
  // variable-backed color back to its light value.
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  if (wasDark) root.classList.remove("dark");

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
  } finally {
    if (wasDark) root.classList.add("dark");
  }
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.height / canvas.width;
  const fullH = pageW * ratio;

  if (fullH <= pageH) {
    pdf.addImage(img, "PNG", 0, 0, pageW, fullH);
  } else {
    // Taller than one page: slice the canvas into page-sized chunks.
    const pageCanvasH = (pageH / pageW) * canvas.width;
    let renderedH = 0;
    let first = true;
    while (renderedH < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - renderedH);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, -renderedH);
      if (!first) pdf.addPage();
      pdf.addImage(
        sliceCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pageW,
        (sliceH / canvas.width) * pageW,
      );
      renderedH += sliceH;
      first = false;
    }
  }
  pdf.save(`${fileBase}.pdf`);
};
