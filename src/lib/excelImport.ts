// Reads the pre-ERP order spreadsheet ("oborot" Excel) into plain import
// records: orders grouped from product rows, their customers, and the
// product catalog with tier prices. Pure — no Firestore here, so the same
// parsing is unit-tested (tests/excelImport.test.ts) and previewed before
// anything is written (see importService.ts).
//
// Columns are found by their header text, not position, so a month's file
// with an extra or reordered column still reads the same.
import { PRODUCT_CATEGORIES, UZBEKISTAN_REGIONS } from "./orderConstants";

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetInput = { sheet: string; data: Cell[][] };

export type ImportFile = { label: string; url: string };

export type ImportLine = {
  ref: string;
  category: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  note: string;
  producer: string;
  files: ImportFile[];
};

export type ImportOrder = {
  key: string;
  refs: string[];
  rows: number[];
  date: string; // YYYY-MM-DD
  deadline: string | null;
  customer_key: string;
  brand: string;
  lines: ImportLine[];
  total: number;
  advance: number;
  payment_type: string;
  branch: string;
  delivery_note: string;
  designer: string;
  producer: string;
  check_url: string;
  status_text: string;
};

export type ImportCustomer = {
  key: string;
  phone: string; // "+998 90 123 45 67" or ""
  extra_phone: string;
  first_name: string;
  last_name: string;
  telegram: string;
  region: string;
  brands: string[];
  first_date: string;
};

export type ImportProductTier = { min_qty: number; price: number; cost: number };
export type ImportProduct = { name: string; category: string; tiers: ImportProductTier[] };

export type ImportProblem = { sheet: string; row: number; reason: string };

export type ParsedWorkbook = {
  orders_sheet: string | null;
  catalog_sheet: string | null;
  orders: ImportOrder[];
  customers: ImportCustomer[];
  products: ImportProduct[];
  problems: ImportProblem[];
  date_from: string | null;
  date_to: string | null;
};

// ── text helpers ─────────────────────────────────────────────────────
export const normText = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const str = (v: Cell): string => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v)).trim();

const num = (v: Cell): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = str(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// 998903035603, 910777707.0, " 90 196 12 02" → "+998 90 196 12 02".
// The last nine digits are the number itself, which also rescues typos in
// the country code ("999 91 282 23 23").
export const formatPhone = (v: Cell): string => {
  const digits = (typeof v === "number" ? String(Math.round(v)) : str(v)).replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 13) return "";
  const nine = digits.slice(-9);
  return `+998 ${nine.slice(0, 2)} ${nine.slice(2, 5)} ${nine.slice(5, 7)} ${nine.slice(7, 9)}`;
};
const phoneKey = (formatted: string) => formatted.replace(/\D/g, "").slice(-9);

// Excel dates arrive as Date (UTC midnight), a serial number, or text.
export const toDay = (v: Cell): string | null => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const s = str(v);
  let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

// "Naqd Namangan", "Karta Farg'ona", "YaTT Namangan" → ERP payment types.
export const mapPaymentType = (v: Cell): string => {
  const s = normText(v);
  if (!s) return "Naqd";
  if (s.includes("click")) return "Click";
  if (s.includes("payme")) return "Payme";
  if (/yatt|hisob|perechis|bank|pul otkaz|otkazma|mchj/.test(s)) return "Hisob raqam";
  if (s.includes("karta") || s.includes("card") || s.includes("terminal")) return "Karta";
  if (s.includes("naqd") || s.includes("nal")) return "Naqd";
  return "Naqd";
};

const BRANCHES = ["Namangan", "Farg'ona", "Andijon", "Toshkent"];
const branchOf = (...vals: Cell[]): string => {
  for (const v of vals) {
    const s = normText(v);
    const b = BRANCHES.find((x) => s.includes(normText(x)));
    if (b) return b;
  }
  return "";
};

const categoryOf = (v: Cell): string => {
  const s = normText(v);
  return PRODUCT_CATEGORIES.find((c) => normText(c) === s) || "";
};

const regionOf = (v: Cell): string => {
  const s = normText(v);
  if (!s) return "";
  return UZBEKISTAN_REGIONS.find((r) => normText(r) === s || normText(r).startsWith(s)) || str(v);
};

// ── order sheet ──────────────────────────────────────────────────────
type Field =
  | "id" | "category" | "date" | "first_name" | "last_name" | "phone" | "phone2" | "telegram" | "region" | "delivery"
  | "brand" | "product" | "note1" | "note2" | "quantity" | "unit_price" | "discount" | "total" | "advance" | "remaining"
  | "payment" | "check" | "deadline" | "design_file" | "design_image" | "designer" | "status" | "producer";

const ALIASES: Record<Field, string[]> = {
  id: ["id", "raqam", "buyurtma id"],
  category: ["qayerga", "kategoriya", "yonalish"],
  date: ["sana", "buyurtma sanasi", "sanasi"],
  first_name: ["ism", "ismi", "mijoz", "mijoz ismi"],
  last_name: ["familiya", "familiyasi"],
  phone: ["nomer 1", "nomer", "telefon", "telefon 1", "tel"],
  phone2: ["nomer 2", "telefon 2", "qoshimcha telefon"],
  telegram: ["telegram"],
  region: ["viloyat", "hudud"],
  delivery: ["logistika kelishuvi", "logistika", "yetkazish"],
  brand: ["brend", "brand", "kompaniya"],
  product: ["mahsulot", "maxsulot", "mahsulot nomi"],
  note1: ["siryo komentariya", "siryo", "material izoh"],
  note2: ["ish komentariya", "izoh", "komentariya"],
  quantity: ["soni", "miqdori", "soni dona"],
  unit_price: ["dona narxi", "narxi"],
  discount: ["chegirma"],
  total: ["jami summa", "umumiy summa", "summa", "jami"],
  advance: ["avans", "tolandi", "tolangan"],
  remaining: ["qoldiq", "qarz"],
  payment: ["tolov turi", "karta naqd", "tolov"],
  check: ["check", "chek"],
  deadline: ["srok", "muddat"],
  design_file: ["dizayn fayl"],
  design_image: ["dizayn rasmi"],
  designer: ["dizayner"],
  status: ["jarayon", "holat", "status"],
  producer: ["kimga berildi", "ishlab chiqaruvchi", "sex"],
};

const matchHeader = (header: Cell[]): Partial<Record<Field, number>> => {
  const cols: Partial<Record<Field, number>> = {};
  header.forEach((h, i) => {
    const t = normText(h);
    if (!t) return;
    for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
      if (cols[field] === undefined && names.includes(t)) {
        cols[field] = i;
        return;
      }
    }
  });
  return cols;
};

const findOrderHeader = (s: SheetInput): { row: number; cols: Partial<Record<Field, number>> } | null => {
  for (let r = 0; r < Math.min(6, s.data.length); r++) {
    const cols = matchHeader(s.data[r] || []);
    if (cols.date !== undefined && cols.product !== undefined && cols.total !== undefined && (cols.phone !== undefined || cols.first_name !== undefined)) {
      return { row: r, cols };
    }
  }
  return null;
};

const parseOrders = (s: SheetInput, header: { row: number; cols: Partial<Record<Field, number>> }, problems: ImportProblem[]) => {
  const c = header.cols;
  const get = (row: Cell[], f: Field): Cell => (c[f] === undefined ? null : row[c[f] as number]);
  const orders = new Map<string, ImportOrder>();
  const customers = new Map<string, ImportCustomer>();

  s.data.slice(header.row + 1).forEach((row, i) => {
    const rowNo = header.row + i + 2; // 1-based, as Excel shows it
    const product = str(get(row, "product"));
    const quantity = num(get(row, "quantity"));
    let total = num(get(row, "total"));
    if (!product && !total && !str(get(row, "first_name")) && !str(get(row, "phone"))) return; // blank row

    const date = toDay(get(row, "date"));
    if (!date) return void problems.push({ sheet: s.sheet, row: rowNo, reason: "Sana yo'q yoki noto'g'ri" });
    if (!product) return void problems.push({ sheet: s.sheet, row: rowNo, reason: "Mahsulot nomi yo'q" });
    // Only an empty total is worked out from the price; a written 0 stays 0.
    if (str(get(row, "total")) === "" && quantity) total = quantity * (num(get(row, "unit_price")) - num(get(row, "discount")));
    total = Math.max(0, Math.round(total));
    // A line with a quantity but no price was given for free (bonus) — keep it.
    if (!total && !quantity) return void problems.push({ sheet: s.sheet, row: rowNo, reason: "Soni ham, summasi ham yo'q" });

    const phone = formatPhone(get(row, "phone"));
    const first = str(get(row, "first_name"));
    const last = str(get(row, "last_name"));
    if (!phone && !first) return void problems.push({ sheet: s.sheet, row: rowNo, reason: "Mijoz ismi ham, telefoni ham yo'q" });
    const customerKey = phone ? phoneKey(phone) : `name:${normText(`${first} ${last}`)}`;

    // Customer
    const brand = str(get(row, "brand"));
    let cust = customers.get(customerKey);
    if (!cust) {
      cust = { key: customerKey, phone, extra_phone: "", first_name: first, last_name: last, telegram: "", region: "", brands: [], first_date: date };
      customers.set(customerKey, cust);
    }
    if (!cust.first_name && first) cust.first_name = first;
    if (!cust.last_name && last) cust.last_name = last;
    const extra = formatPhone(get(row, "phone2"));
    if (!cust.extra_phone && extra && extra !== cust.phone) cust.extra_phone = extra;
    if (!cust.telegram) cust.telegram = str(get(row, "telegram"));
    if (!cust.region) cust.region = regionOf(get(row, "region"));
    if (brand && !cust.brands.some((b) => normText(b) === normText(brand))) cust.brands.push(brand);
    if (date < cust.first_date) cust.first_date = date;

    // Line
    const notes: string[] = [];
    const files: ImportFile[] = [];
    for (const [f, label] of [["note1", "Material"], ["note2", "Ish"]] as [Field, string][]) {
      const v = str(get(row, f));
      if (!v) continue;
      if (isUrl(v)) files.push({ label: `${label} izohi`, url: v });
      else notes.push(v);
    }
    for (const [f, label] of [["design_file", "Dizayn fayl"], ["design_image", "Dizayn rasmi"]] as [Field, string][]) {
      const v = str(get(row, f));
      if (isUrl(v)) files.push({ label, url: v });
    }
    const uniqueFiles = files.filter((f, i) => files.findIndex((x) => x.url === f.url) === i);
    const qty = quantity > 0 ? quantity : 1;
    const ref = str(get(row, "id"));
    const line: ImportLine = {
      ref,
      category: categoryOf(get(row, "category")),
      product_name: product,
      quantity: qty,
      unit_price: Math.round((total / qty) * 100) / 100,
      total,
      note: notes.join(" · "),
      producer: str(get(row, "producer")),
      files: uniqueFiles,
    };

    // Order: one customer's rows on the same day are one order.
    const orderKey = `${customerKey}|${date}`;
    let order = orders.get(orderKey);
    if (!order) {
      order = {
        key: orderKey,
        refs: [],
        rows: [],
        date,
        deadline: toDay(get(row, "deadline")),
        customer_key: customerKey,
        brand,
        lines: [],
        total: 0,
        advance: 0,
        payment_type: mapPaymentType(get(row, "payment")),
        branch: branchOf(get(row, "payment"), get(row, "region"), ref),
        delivery_note: str(get(row, "delivery")),
        designer: str(get(row, "designer")),
        producer: line.producer,
        check_url: isUrl(str(get(row, "check"))) ? str(get(row, "check")) : "",
        status_text: str(get(row, "status")),
      };
      orders.set(orderKey, order);
    }
    if (ref && !order.refs.includes(ref)) order.refs.push(ref);
    order.rows.push(rowNo);
    order.lines.push(line);
    order.total += line.total;
    order.advance += Math.max(0, num(get(row, "advance")));
    if (!order.brand && brand) order.brand = brand;
    if (!order.check_url && isUrl(str(get(row, "check")))) order.check_url = str(get(row, "check"));
    if (order.producer && line.producer && order.producer !== line.producer) order.producer = "Bir nechta";
  });

  for (const o of orders.values()) o.advance = Math.min(o.advance, o.total);
  return { orders: [...orders.values()], customers: [...customers.values()] };
};

// ── catalog sheet ────────────────────────────────────────────────────
// Blocks of: a title row with the product name, then rows of
// qty | cost/unit | cost total | price/unit | price total.
const findCatalogCols = (s: SheetInput): { sell: number; cost: number; start: number } | null => {
  for (let r = 0; r < Math.min(4, s.data.length); r++) {
    const row = (s.data[r] || []).map(normText);
    const sell = row.findIndex((t) => t.startsWith("sotish narx"));
    const cost = row.findIndex((t) => t.includes("tan narx"));
    if (sell > 0) return { sell, cost, start: r + 1 };
  }
  return null;
};

const parseCatalog = (s: SheetInput, cols: { sell: number; cost: number; start: number }): ImportProduct[] => {
  const products = new Map<string, ImportProduct>();
  let current: ImportProduct | null = null;
  for (const row of s.data.slice(cols.start)) {
    const a = row[0];
    const sell = num(row[cols.sell]);
    if (typeof a === "number" && a > 0 && sell > 0) {
      if (!current) continue;
      if (!current.tiers.some((t) => t.min_qty === a)) {
        current.tiers.push({ min_qty: a, price: sell, cost: cols.cost >= 0 ? num(row[cols.cost]) : 0 });
      }
      continue;
    }
    const name = typeof a === "string" ? a.trim() : "";
    if (name && !num(row[cols.sell])) {
      const key = normText(name);
      current = products.get(key) || { name, category: "", tiers: [] };
      products.set(key, current);
    }
  }
  const out = [...products.values()].filter((p) => p.tiers.length);
  out.forEach((p) => p.tiers.sort((x, y) => x.min_qty - y.min_qty));
  return out;
};

// ── entry point ──────────────────────────────────────────────────────
export const parseWorkbook = (sheets: SheetInput[]): ParsedWorkbook => {
  const problems: ImportProblem[] = [];
  // A "Filter …" sheet repeats the main one; only use it if nothing else fits.
  const candidates = sheets
    .map((s) => ({ s, header: findOrderHeader(s) }))
    .filter((x) => x.header)
    .sort((x, y) => Number(/filter/i.test(x.s.sheet)) - Number(/filter/i.test(y.s.sheet)));
  const ordersSheet = candidates[0] || null;
  const parsed = ordersSheet ? parseOrders(ordersSheet.s, ordersSheet.header!, problems) : { orders: [], customers: [] };

  let catalogSheet: SheetInput | null = null;
  let products: ImportProduct[] = [];
  for (const s of sheets) {
    const cols = findCatalogCols(s);
    if (!cols) continue;
    catalogSheet = s;
    products = parseCatalog(s, cols);
    break;
  }
  // Category for a catalog product: whatever the orders filed it under.
  const catByName = new Map<string, string>();
  for (const o of parsed.orders) for (const l of o.lines) if (l.category) catByName.set(normText(l.product_name), l.category);
  for (const p of products) p.category = catByName.get(normText(p.name)) || "";

  const dates = parsed.orders.map((o) => o.date).sort();
  parsed.orders.sort((a, b) => a.date.localeCompare(b.date) || a.rows[0] - b.rows[0]);
  return {
    orders_sheet: ordersSheet ? ordersSheet.s.sheet : null,
    catalog_sheet: catalogSheet ? catalogSheet.sheet : null,
    orders: parsed.orders,
    customers: parsed.customers,
    products,
    problems,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
  };
};
