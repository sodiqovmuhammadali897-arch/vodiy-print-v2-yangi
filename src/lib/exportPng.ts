import html2canvas from "html2canvas";

export const exportNodeToPng = async (node: HTMLElement, fileBase: string): Promise<void> => {
  // Capturing before web fonts finish loading makes html2canvas fall back
  // to a system font with different metrics — text sits at different
  // widths than what's on screen, which can even push flex-wrapped content
  // onto a different line than the live page shows.
  await document.fonts.ready;
  const canvas = await html2canvas(node, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = `${fileBase}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};
