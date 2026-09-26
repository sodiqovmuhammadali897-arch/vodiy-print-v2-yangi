// The customer price sheet as a PNG image — same content and look as the
// PDF (pdf.js), drawn with @napi-rs/canvas (prebuilt, no system libraries)
// at 2x so small print stays sharp when a customer zooms in.
const path = require("path");
const { createCanvas, GlobalFonts, loadImage: decodeImage } = require("@napi-rs/canvas");
const { sortTiers, unitPriceFor, money, ddmmyyyy, loadImage } = require("./pdf");

GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "DejaVuSans.ttf"), "DV");
GlobalFonts.registerFromPath(path.join(__dirname, "fonts", "DejaVuSans-Bold.ttf"), "DVB");

const S = 2; // scale: layout below is in PDF points (A4 width 595)
const GREEN = "#059669";
const GREEN_LIGHT = "#ecfdf5";
const INK = "#13262f";
const MUTED = "#5b6b73";
const RED = "#e11d48";

// Word-wrap `text` to `width`; returns the lines.
const wrap = (g, text, width) => {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const t = line ? `${line} ${word}` : word;
      if (g.measureText(t).width > width && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
};

const roundRect = (g, x, y, w, h, r, color) => {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
};

const buildPriceSheetPng = async ({ product, company = {}, quantity = 0 }) => {
  const W = 595;
  const L = 40;
  const CW = W - 80;
  const unit = product.unit || "dona";
  const tiers = sortTiers(product.price_tiers);
  const now = new Date(Date.now() + 5 * 3600 * 1000);
  const imgBuf = await loadImage(product.image_url);
  const img = imgBuf ? await decodeImage(imgBuf).catch(() => null) : null;

  // Measure pass on a scratch canvas to size the page to its content.
  const draw = (g) => {
    const font = (bold, size) => (g.font = `${size}px ${bold ? "DVB" : "DV"}`);
    const text = (t, x, y, { bold = false, size = 10, color = INK, align = "left" } = {}) => {
      font(bold, size);
      g.fillStyle = color;
      g.textAlign = align;
      g.textBaseline = "top";
      g.fillText(t, x, y);
    };
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, 5000);

    roundRect(g, L, 40, 44, 44, 8, GREEN);
    text((company.name || "VP").slice(0, 2).toUpperCase(), L + 22, 54, { bold: true, size: 16, color: "#fff", align: "center" });
    text(company.name || "Vodiy Print", L + 56, 42, { bold: true, size: 20, color: GREEN });
    text("Narx taklifi", L + 56, 68, { color: MUTED });
    text(ddmmyyyy(now), L + CW, 48, { color: MUTED, align: "right" });
    g.fillStyle = GREEN;
    g.fillRect(L, 96, CW, 3);

    let y = 116;
    const tx = img ? L + 110 : L;
    const tw = CW - (tx - L);
    if (img) {
      g.save();
      g.beginPath();
      g.roundRect(L, y, 96, 96, 12);
      g.clip();
      const s = Math.max(96 / img.width, 96 / img.height);
      g.drawImage(img, L + (96 - img.width * s) / 2, y + (96 - img.height * s) / 2, img.width * s, img.height * s);
      g.restore();
    }
    font(true, 18);
    let ty = y;
    for (const ln of wrap(g, product.name || "Mahsulot", tw)) {
      text(ln, tx, ty, { bold: true, size: 18 });
      ty += 23;
    }
    if (product.description) {
      font(false, 10);
      for (const ln of wrap(g, product.description, tw)) {
        text(ln, tx, ty + 2, { color: MUTED });
        ty += 14;
      }
    }
    const facts = [];
    if (Number(product.min_order_qty) > 0) facts.push(`Minimal tiraj: ${product.min_order_qty} ${unit}`);
    if (Number(product.lead_time_days) > 0) facts.push(`Tayyor bo'lish muddati: ${product.lead_time_days} ish kuni`);
    if (facts.length) {
      text(facts.join("     "), tx, ty + 6, { bold: true, size: 9.5 });
      ty += 20;
    }
    y = Math.max(ty, img ? y + 96 : ty) + 16;

    const specs = [
      ["O'LCHAM", product.size_spec], ["MATERIAL", product.material], ["BOSMA TURI", product.print_type],
      ["QOG'OZ QALINLIGI", product.paper_weight], ["LAMINATSIYA", product.lamination], ["QADOQLASH", product.packaging],
    ].filter(([, v]) => v);
    if (specs.length) {
      const colW = CW / 3;
      const boxH = Math.ceil(specs.length / 3) * 40 + 16;
      roundRect(g, L, y, CW, boxH, 10, GREEN_LIGHT);
      specs.forEach(([label, value], i) => {
        const cx = L + 14 + (i % 3) * colW;
        const cy = y + 12 + Math.floor(i / 3) * 40;
        text(label, cx, cy, { bold: true, size: 7.5, color: "#047857" });
        font(true, 10);
        text(wrap(g, String(value), colW - 20)[0], cx, cy + 12, { bold: true });
      });
      y += boxH + 18;
    }

    const c1 = CW * 0.36;
    const c2 = CW * 0.3;
    roundRect(g, L, y, CW, 28, 8, GREEN);
    text("TIRAJ", L + 12, y + 10, { bold: true, size: 9, color: "#fff" });
    text("DONA NARXI", L + c1 + c2 - 12, y + 10, { bold: true, size: 9, color: "#fff", align: "right" });
    text("UMUMIY SUMMA", L + CW - 12, y + 10, { bold: true, size: 9, color: "#fff", align: "right" });
    y += 32;
    if (!tiers.length) {
      text("Narxlar kiritilmagan", L + 12, y + 8, { color: MUTED });
      y += 30;
    }
    tiers.forEach((t, i) => {
      g.fillStyle = i % 2 ? "#ffffff" : GREEN_LIGHT;
      g.fillRect(L, y, CW, 30);
      text(`${t.min_qty}+ ${unit}`, L + 12, y + 9, { size: 10.5 });
      text(money(t.price), L + c1 + c2 - 12, y + 9, { bold: true, size: 10.5, align: "right" });
      text(money(t.price * t.min_qty), L + CW - 12, y + 9, { bold: true, size: 10.5, align: "right" });
      y += 30;
    });

    if (quantity > 0 && tiers.length) {
      const price = unitPriceFor(tiers, quantity);
      y += 12;
      roundRect(g, L, y, CW, 54, 10, GREEN);
      text(`${quantity} ${unit.toUpperCase()} UCHUN`, L + 16, y + 12, { bold: true, size: 9, color: "#fff" });
      text(`1 ${unit}: ${money(price)}`, L + 16, y + 28, { color: "#fff" });
      text("JAMI", L + CW - 16, y + 12, { bold: true, size: 9, color: "#fff", align: "right" });
      text(money(price * quantity), L + CW - 16, y + 25, { bold: true, size: 16, color: "#fff", align: "right" });
      y += 54;
    }

    y += 18;
    const until = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    g.fillStyle = RED;
    g.fillRect(L, y, 4, 44);
    g.fillStyle = "#fff1f2";
    g.fillRect(L + 4, y, CW - 4, 44);
    text("ESLATMA!", L + 16, y + 8, { bold: true, color: RED });
    text(`Ushbu narxlar ${ddmmyyyy(until)} gacha amal qiladi.`, L + 16, y + 24);
    y += 64;

    const contacts = [company.phone, company.telegram, company.email, company.address].filter(Boolean);
    if (contacts.length) {
      g.fillStyle = "#d6e1e4";
      g.fillRect(L, y, CW, 0.5);
      font(false, 9);
      let cy = y + 10;
      for (const ln of wrap(g, contacts.join("   ·   "), CW)) {
        text(ln, L, cy, { size: 9, color: MUTED });
        cy += 13;
      }
      y = cy;
    }
    return y + 40;
  };

  const probe = createCanvas(W, 10).getContext("2d");
  const height = Math.max(842 * 0.75, Math.ceil(draw(probe)));
  const canvas = createCanvas(W * S, height * S);
  const g = canvas.getContext("2d");
  g.scale(S, S);
  draw(g);
  return canvas.toBuffer("image/png");
};

module.exports = { buildPriceSheetPng };
