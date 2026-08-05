import { htmlToPdf } from "../../lib/htmlToPdf";

export const exportTextileMatrixPdf = async (node: HTMLElement, fileBase: string) => {
  const pdf = await htmlToPdf(node);
  pdf.save(`${fileBase}.pdf`);
};

// Opens the generated PDF in a new tab so the user can print it from the
// browser's own PDF viewer (which always has a print button), instead of
// trying to reproduce a print dialog ourselves.
export const printTextileMatrix = async (node: HTMLElement) => {
  const pdf = await htmlToPdf(node);
  const url = pdf.output("bloburl");
  window.open(url, "_blank");
};

export const shareTextileMatrix = async (
  node: HTMLElement,
  fileBase: string,
  summary: string,
) => {
  const pdf = await htmlToPdf(node);
  const blob = pdf.output("blob");
  const file = new File([blob], `${fileBase}.pdf`, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (nav.canShare && nav.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: fileBase, text: summary });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: fileBase, text: summary });
    return;
  }
  try {
    await navigator.clipboard.writeText(summary);
    alert("Brauzeringiz fayl ulashishni qo'llab-quvvatlamaydi — matn nusxalandi, PDF-ni yuklab olib qo'shimcha yuboring.");
  } catch {
    alert("Brauzeringiz ulashishni qo'llab-quvvatlamaydi. PDF tugmasi orqali yuklab oling.");
  }
};
