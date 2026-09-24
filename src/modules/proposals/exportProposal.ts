import { htmlToPdf } from "../../lib/htmlToPdf";
import { exportNodeToPng } from "../../lib/exportPng";

export const exportProposalPng = (node: HTMLElement, fileBase: string) => exportNodeToPng(node, fileBase);

export const exportProposalPdf = async (node: HTMLElement, fileBase: string) => {
  const pdf = await htmlToPdf(node);
  pdf.save(`${fileBase}.pdf`);
};
