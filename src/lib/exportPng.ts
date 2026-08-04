import html2canvas from "html2canvas";

export const exportNodeToPng = async (node: HTMLElement, fileBase: string): Promise<void> => {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = `${fileBase}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};
