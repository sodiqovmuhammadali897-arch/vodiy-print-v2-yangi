import { htmlToPdf, htmlToPng } from "../../lib/htmlToPdf";

export const exportProposalPng = async (node: HTMLElement, fileBase: string) => {
  const dataUrl = await htmlToPng(node);
  const link = document.createElement("a");
  link.download = `${fileBase}.png`;
  link.href = dataUrl;
  link.click();
};

export const exportProposalPdf = async (node: HTMLElement, fileBase: string) => {
  const pdf = await htmlToPdf(node);
  pdf.save(`${fileBase}.pdf`);
};
