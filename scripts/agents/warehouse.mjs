// "Omborchi": materials at or below their minimum stock, and yesterday's
// stock movements.
import { Report, bullets, esc, getDb, readAll, readCreatedYesterday } from "./lib.mjs";

const r = new Report("📦 Omborchi — kunlik hisobot", "wh");

if (!getDb()) {
  r.sections.push(r.warn("FIREBASE_SERVICE_ACCOUNT sozlanmagan"));
  await r.send("TELEGRAM_WAREHOUSE_CHAT_ID");
  process.exit(0);
}

const [items, moves] = await Promise.all([readAll("warehouse_items"), readCreatedYesterday("warehouse_transactions")]);
const qty = (x) => `${Number(x.quantity || 0)} ${esc(x.unit || "")}`.trim();

await r.section("🛒 Buyurtma berish kerak", async () => {
  const empty = items.filter((i) => Number(i.quantity || 0) <= 0);
  const low = items.filter((i) => Number(i.quantity || 0) > 0 && Number(i.min_threshold || 0) > 0 && Number(i.quantity) <= Number(i.min_threshold));
  const lines = [`• Omborda jami: ${items.length} xil material`];
  if (empty.length === 0 && low.length === 0) return [...lines, r.ok("Hamma materiallar yetarli")];
  if (empty.length > 0) {
    lines.push(r.fail(`Tugagan: ${empty.length} ta`));
    lines.push(...bullets(empty, 10, (i) => esc(i.name)));
  }
  if (low.length > 0) {
    lines.push(r.warn(`Minimal qoldiqdan kam: ${low.length} ta`));
    lines.push(...bullets(low, 10, (i) => `${esc(i.name)} — ${qty(i)} qoldi (minimum ${Number(i.min_threshold)})`));
  }
  return lines;
});

await r.section("🔄 Kechagi harakat", async () => {
  if (moves.length === 0) return ["• Kecha kirim-chiqim bo'lmagan"];
  const unit = new Map(items.map((i) => [i.id, i.unit || ""]));
  const line = (m) => `${esc(m.item_name)} ${Number(m.quantity || 0)} ${esc(unit.get(m.item_id) || "")}`.trim() + (m.performed_by ? ` (${esc(m.performed_by)})` : "");
  const ins = moves.filter((m) => m.type === "in");
  const outs = moves.filter((m) => m.type === "out");
  const lines = [];
  if (ins.length > 0) lines.push(`• Kirim: ${ins.length} ta`, ...bullets(ins, 6, line));
  if (outs.length > 0) lines.push(`• Chiqim: ${outs.length} ta`, ...bullets(outs, 6, line));
  return lines;
});

await r.send("TELEGRAM_WAREHOUSE_CHAT_ID");
