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

export const exportProposalPdf = async (node: HTMLElement, fileBase: string) => {
  const canvas = await capture(node);
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.height / canvas.width;
  let w = pageW;
  let h = pageW * ratio;
  if (h > pageH) {
    h = pageH;
    w = pageH / ratio;
  }
  const x = (pageW - w) / 2;
  const y = 0;
  pdf.addImage(img, "PNG", x, y, w, h);
  pdf.save(`${fileBase}.pdf`);
};
