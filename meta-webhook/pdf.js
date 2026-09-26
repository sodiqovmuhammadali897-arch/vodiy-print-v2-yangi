// Customer-facing product price sheet as a PDF, for the Hisobchi bot.
// Mirrors src/modules/products/ProductCustomerPrice.tsx: reads only the
// product's price tiers, specs and description plus company contacts —
// never cost, margin or supplier data — so it is safe to send a customer.
const path = require("path");
const PDFDocument = require("pdfkit");

const FONT = path.join(__dirname, "fonts", "DejaVuSans.ttf");
const FONT_BOLD = path.join(__dirname, "fonts", "DejaVuSans-Bold.ttf");
const GREEN = "#059669";
const GREEN_LIGHT = "#ecfdf5";
const INK = "#13262f";
const MUTED = "#5b6b73";
const RED = "#e11d48";

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/[\s,  ]/g, " ")} so'm`;
const ddmmyyyy = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
const sortTiers = (tiers) => [...(tiers || [])].filter((t) => Number(t.min_qty) > 0).sort((a, b) => a.min_qty - b.min_qty);
// Same rule as the website: the largest tier the quantity reaches.
const unitPriceFor = (tiers, qty) => {
  const sorted = sortTiers(tiers);
  if (!sorted.length) return 0;
  let price = sorted[0].price;
  for (const t of sorted) if (qty >= t.min_qty) price = t.price;
  return price;
};

// Best-effort product photo: skipped silently if it can't be fetched or
// isn't a JPEG/PNG (pdfkit's only raster formats).
const loadImage = async (url) => {
  if (!/^https?:\/\//.test(url || "")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isJpeg || isPng ? buf : null;
  } catch {
    return null;
  }
};

const buildPriceSheet = async ({ product, company = {}, quantity = 0 }) => {
  const image = await loadImage(product.image_url);
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `${product.name} — narx taklifi`, Author: company.name || "Vodiy Print" } });
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const L = 40;
  const W = doc.page.width - 80;
  const unit = product.unit || "dona";
  const now = new Date(Date.now() + 5 * 3600 * 1000); // Tashkent calendar date

  // Header
  doc.roundedRect(L, 40, 44, 44, 8).fill(GREEN);
  doc.font("b").fontSize(16).fillColor("#fff").text((company.name || "VP").slice(0, 2).toUpperCase(), L, 53, { width: 44, align: "center" });
  doc.font("b").fontSize(20).fillColor(GREEN).text(company.name || "Vodiy Print", L + 56, 42);
  doc.font("r").fontSize(10).fillColor(MUTED).text("Narx taklifi", L + 56, 68);
  doc.font("r").fontSize(10).fillColor(MUTED).text(ddmmyyyy(now), L, 48, { width: W, align: "right" });
  doc.rect(L, 96, W, 3).fill(GREEN);

  // Product
  let y = 116;
  const textX = image ? L + 110 : L;
  if (image) {
    try {
      doc.save().roundedRect(L, y, 96, 96, 12).clip().image(image, L, y, { cover: [96, 96], align: "center", valign: "center" }).restore();
    } catch {
      /* unreadable image: leave the space */
    }
  }
  doc.font("b").fontSize(18).fillColor(INK).text(product.name || "Mahsulot", textX, y, { width: W - (textX - L) });
  if (product.description) {
    doc.moveDown(0.3).font("r").fontSize(10).fillColor(MUTED).text(product.description, { width: W - (textX - L) });
  }
  const facts = [];
  if (Number(product.min_order_qty) > 0) facts.push(`Minimal tiraj: ${product.min_order_qty} ${unit}`);
  if (Number(product.lead_time_days) > 0) facts.push(`Tayyor bo'lish muddati: ${product.lead_time_days} ish kuni`);
  if (facts.length) doc.moveDown(0.4).font("b").fontSize(9.5).fillColor(INK).text(facts.join("     "), { width: W - (textX - L) });
  y = Math.max(doc.y, image ? y + 96 : doc.y) + 16;

  // Specs
  const specs = [
    ["O'LCHAM", product.size_spec],
    ["MATERIAL", product.material],
    ["BOSMA TURI", product.print_type],
    ["QOG'OZ QALINLIGI", product.paper_weight],
    ["LAMINATSIYA", product.lamination],
    ["QADOQLASH", product.packaging],
  ].filter(([, v]) => v);
  if (specs.length) {
    const colW = W / 3;
    const rows = Math.ceil(specs.length / 3);
    const boxH = rows * 40 + 16;
    doc.roundedRect(L, y, W, boxH, 10).fill(GREEN_LIGHT);
    specs.forEach(([label, value], i) => {
      const cx = L + 14 + (i % 3) * colW;
      const cy = y + 12 + Math.floor(i / 3) * 40;
      doc.font("b").fontSize(7.5).fillColor("#047857").text(label, cx, cy, { width: colW - 20 });
      doc.font("b").fontSize(10).fillColor(INK).text(String(value), cx, cy + 12, { width: colW - 20, height: 24, ellipsis: true });
    });
    y += boxH + 18;
  }

  // Price tiers
  const tiers = sortTiers(product.price_tiers);
  const c1 = W * 0.36;
  const c2 = W * 0.3;
  doc.roundedRect(L, y, W, 28, 8).fill(GREEN);
  doc.font("b").fontSize(9).fillColor("#fff");
  doc.text("TIRAJ", L + 12, y + 10);
  doc.text("DONA NARXI", L + c1, y + 10, { width: c2 - 12, align: "right" });
  doc.text("UMUMIY SUMMA", L + c1 + c2, y + 10, { width: W - c1 - c2 - 12, align: "right" });
  y += 32;
  if (!tiers.length) {
    doc.font("r").fontSize(10).fillColor(MUTED).text("Narxlar kiritilmagan", L + 12, y + 8);
    y += 30;
  }
  tiers.forEach((t, i) => {
    if (y > doc.page.height - 150) {
      doc.addPage();
      y = 40;
    }
    doc.rect(L, y, W, 30).fill(i % 2 ? "#ffffff" : GREEN_LIGHT);
    doc.font("r").fontSize(10.5).fillColor(INK).text(`${t.min_qty}+ ${unit}`, L + 12, y + 10);
    doc.font("b").text(money(t.price), L + c1, y + 10, { width: c2 - 12, align: "right" });
    doc.font("b").text(money(t.price * t.min_qty), L + c1 + c2, y + 10, { width: W - c1 - c2 - 12, align: "right" });
    y += 30;
  });

  // Quote for a requested quantity
  if (quantity > 0 && tiers.length) {
    const price = unitPriceFor(tiers, quantity);
    y += 12;
    doc.roundedRect(L, y, W, 54, 10).fill(GREEN);
    doc.font("b").fontSize(9).fillColor("#fff").text(`${quantity} ${unit.toUpperCase()} UCHUN`, L + 16, y + 12);
    doc.font("r").fontSize(10).text(`1 ${unit}: ${money(price)}`, L + 16, y + 28);
    doc.font("b").fontSize(9).text("JAMI", L, y + 12, { width: W - 16, align: "right" });
    doc.font("b").fontSize(16).text(money(price * quantity), L, y + 25, { width: W - 16, align: "right" });
    y += 54;
  }

  // Validity note
  y += 18;
  const until = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  doc.rect(L, y, 4, 44).fill(RED);
  doc.rect(L + 4, y, W - 4, 44).fill("#fff1f2");
  doc.font("b").fontSize(10).fillColor(RED).text("ESLATMA!", L + 16, y + 8);
  doc.font("r").fontSize(10).fillColor(INK).text(`Ushbu narxlar ${ddmmyyyy(until)} gacha amal qiladi.`, L + 16, y + 24);
  y += 64;

  // Contacts
  const contacts = [company.phone, company.telegram, company.email, company.address].filter(Boolean);
  if (contacts.length) {
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor("#d6e1e4").stroke();
    doc.font("r").fontSize(9).fillColor(MUTED).text(contacts.join("   ·   "), L, y + 10, { width: W });
  }

  doc.end();
  return done;
};

module.exports = { buildPriceSheet, unitPriceFor };
