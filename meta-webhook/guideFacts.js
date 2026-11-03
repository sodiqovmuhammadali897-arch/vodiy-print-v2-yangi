// Mahsulot qo'llanmasi (Darslik → «Mahsulot qo'llanmasi») — the live facts
// behind each product family for new sellers: how it sells since the ERP
// started (July 2026), the usual run and price, who buys it (customer
// industry), what it is bought with, the specs typed most, and the catalog
// models with their price tiers. Sellers may not read every order, so the
// server works the numbers out and writes guide_facts/{family} (counts and
// sums only, no customer names) plus guide_facts/_meta (totals and catalog
// gaps for the admin). Recomputed on start and every 6 hours; a doc is
// written only when it changed.

const SINCE = "2026-07"; // the ERP is used for every order from July 2026
const EVERY_MS = 6 * 3600 * 1000;

// Order lines are typed by hand, so families are matched by words in the
// name. First match wins (a "set" of paket+bloknot is a gift set).
// `lesson`: the Darslik lesson that teaches the family.
const FAMILIES = [
  { key: "gift-box", title: "Gift box / set", lesson: "gift-box", re: /gift|sovg|quti|box|\bset\b|kombo/ },
  { key: "paket", title: "Qog'oz paket", lesson: "paket", re: /paket|пакет|shopper/ },
  { key: "bloknot", title: "Bloknot", lesson: "kanselyariya", re: /bloknot|blaknot|ежедн|kundalik|daftar|kubarik/ },
  { key: "futbolka", title: "Futbolka", lesson: "futbolka", re: /futbol|polo/ },
  { key: "kepka", title: "Kepka", lesson: "xudi-kepka", re: /kepka|кепк|panama/ },
  { key: "ustki-kiyim", title: "Nimcha / xudi", lesson: "xudi-kepka", re: /nimcha|kamzul|bomber|finka|xudi|hudi|kurtka|svitshot|jilet|fartuk/ },
  { key: "bakal", title: "Bakal / termos", lesson: "idish-suvenir", re: /bakal|krujk|kruj|stakan|termos|кружк/ },
  { key: "ruchka", title: "Ruchka", lesson: "kanselyariya", re: /ruchka|ручк|qalam/ },
  { key: "papka", title: "Papka", lesson: "katalog-papka", re: /papka|папк/ },
  { key: "flayer", title: "Flayer / buklet", lesson: "flayer-buklet", re: /flayer|flyer|listovka|liflet|buklet|door hanger|лист/ },
  { key: "vizitka", title: "Vizitka", lesson: "vizitka", re: /vizit|визит/ },
  { key: "katalog", title: "Katalog / jurnal", lesson: "katalog-papka", re: /katalog|jurnal|broshyura|kitob/ },
  { key: "kalendar", title: "Kalendar", lesson: "tipografiya", re: /kalendar|календ/ },
  { key: "stiker", title: "Stiker / yorliq", lesson: "tipografiya", re: /stiker|sticker|yorliq|etiketka|наклей|samokley/ },
  { key: "banner", title: "Banner / roll-up / bayroq", lesson: "banner-rollup", re: /banner|roll|баннер|tent|vinil|bayroq|pauchok/ },
  { key: "blank", title: "Blank / konvert / diplom", lesson: "tipografiya", re: /blank|konvert|бланк|конверт|sertifikat|diplom|gramota/ },
  { key: "suvenir", title: "Suvenir (kovrik, soat, beydjik…)", lesson: "mayda-suvenir", re: /kovrik|brelok|znachok|flesh|usb|soat|suvenir|медал|medal|beydjik|zontik/ },
];

const familyOf = (name) => {
  const n = String(name || "").toLowerCase();
  const f = FAMILIES.find((x) => x.re.test(n));
  return f ? f.key : null;
};

const monthOf = (o) => String(o.order_date || o.created_at || "").slice(0, 7);
const isSale = (o) => o.status !== "cancelled" && !o.is_draft;
const sorted = (xs) => xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
const pick = (xs, p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] : 0);
const medianOf = (xs) => (xs.length ? xs[Math.floor((xs.length - 1) / 2)] : 0);
const clip = (s, n = 40) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const topList = (counts, n, label = "name") =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k, c]) => ({ [label]: k, n: c }));

// Everything for the guide from already loaded data.
function computeFacts({ orders, lines, customers, products }) {
  const live = new Map(orders.filter((o) => isSale(o) && monthOf(o) >= SINCE).map((o) => [o.id, o]));
  const industryOf = new Map(customers.map((c) => [c.id, clip(c.industry, 30)]));
  const own = lines.filter((l) => live.has(l.order_id));
  const famsOfOrder = new Map();
  for (const l of own) {
    const f = familyOf(l.product_name);
    if (!f) continue;
    if (!famsOfOrder.has(l.order_id)) famsOfOrder.set(l.order_id, new Set());
    famsOfOrder.get(l.order_id).add(f);
  }

  const acc = new Map();
  let total = 0;
  let unmatched = 0;
  for (const l of own) {
    const sum = Number(l.total || 0);
    total += sum;
    const f = familyOf(l.product_name);
    if (!f) {
      unmatched += sum;
      continue;
    }
    const o = live.get(l.order_id);
    if (!acc.has(f)) acc.set(f, { orders: new Set(), buyers: new Map(), qty: [], unit: [], line: [], revenue: 0, who: {}, with: {}, specs: {}, months: {} });
    const r = acc.get(f);
    r.orders.add(l.order_id);
    if (o.customer_id) {
      if (!r.buyers.has(o.customer_id)) r.buyers.set(o.customer_id, new Set());
      r.buyers.get(o.customer_id).add(l.order_id);
    }
    r.qty.push(Number(l.quantity || 0));
    r.unit.push(Number(l.unit_price || 0));
    r.line.push(sum);
    r.revenue += sum;
    const who = (o.customer_id && industryOf.get(o.customer_id)) || "";
    if (who) r.who[who] = (r.who[who] || 0) + 1;
    else r.who_unknown = (r.who_unknown || 0) + 1;
    for (const g of famsOfOrder.get(l.order_id) || []) if (g !== f) r.with[g] = (r.with[g] || 0) + 1;
    const spec = [l.variant, l.size, l.material].map((x) => clip(x, 30)).filter(Boolean).join(" · ");
    if (spec) r.specs[spec] = (r.specs[spec] || 0) + 1;
    const m = monthOf(o);
    r.months[m] = (r.months[m] || 0) + sum;
  }

  const active = products.filter((p) => p.is_active !== false && !p.archived_at);
  // How many ERP-era lines were this model: picked from the catalog, or
  // typed with its name (the part before any bracket).
  const base = (s) => String(s || "").split("(")[0].trim().toLowerCase();
  const soldOf = (p) => own.filter((l) => l.catalog_product_id === p.id || (base(l.product_name) && base(l.product_name) === base(p.name))).length;
  const modelsOf = (key) =>
    active
      .filter((p) => familyOf(p.name) === key)
      .map((p) => ({
        id: p.id,
        name: String(p.name || ""),
        // Catalog images are often stored inline (data: URLs, hundreds of
        // KB): the page takes the picture from the product itself.
        has_image: Boolean(p.image_url),
        sold: soldOf(p),
        min_qty: Number(p.min_order_qty || 0) || null,
        lead_days: Number(p.lead_time_days || 0) || null,
        tiers: (p.price_tiers || []).map((t) => ({ min_qty: Number(t.min_qty || 0), price: Number(t.price || 0) })).filter((t) => t.min_qty > 0 && t.price > 0).sort((a, b) => a.min_qty - b.min_qty),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const titleOf = new Map(FAMILIES.map((f) => [f.key, f.title]));
  const families = FAMILIES.map((def) => {
    const r = acc.get(def.key);
    const models = modelsOf(def.key);
    const prices = models.flatMap((m) => m.tiers.map((t) => t.price));
    const days = models.map((m) => m.lead_days).filter(Boolean);
    const mins = models.map((m) => m.min_qty).filter(Boolean);
    const qty = sorted(r ? r.qty : []);
    const unit = sorted(r ? r.unit : []);
    const line = sorted(r ? r.line : []);
    return {
      key: def.key,
      title: def.title,
      lesson: def.lesson,
      orders: r ? r.orders.size : 0,
      revenue: r ? Math.round(r.revenue) : 0,
      buyers: r ? r.buyers.size : 0,
      repeat_buyers: r ? [...r.buyers.values()].filter((s) => s.size > 1).length : 0,
      qty_median: medianOf(qty),
      qty_low: pick(qty, 0.25),
      qty_high: pick(qty, 0.75),
      unit_median: Math.round(medianOf(unit)),
      line_median: Math.round(medianOf(line)),
      who: r ? topList(r.who, 4) : [],
      who_unknown: r ? r.who_unknown || 0 : 0,
      with: r ? topList(r.with, 5, "key").map((x) => ({ ...x, title: titleOf.get(x.key) || x.key })) : [],
      specs: r ? topList(r.specs, 5, "text") : [],
      months: r ? Object.fromEntries(Object.entries(r.months).sort().map(([m, v]) => [m, Math.round(v)])) : {},
      models,
      price_from: prices.length ? Math.min(...prices) : null,
      lead_days: days.length ? { min: Math.min(...days), max: Math.max(...days) } : null,
      min_qty: mins.length ? Math.min(...mins) : null,
    };
  })
    .filter((f) => f.orders > 0 || f.models.length > 0)
    .sort((a, b) => b.revenue - a.revenue || a.title.localeCompare(b.title))
    .map((f, i) => ({ ...f, rank: i + 1 }));

  const top10 = families.slice(0, 10).reduce((s, f) => s + f.revenue, 0);
  const names = {};
  for (const p of active) {
    const k = String(p.name || "").trim().toLowerCase();
    names[k] = (names[k] || 0) + 1;
  }
  const meta = {
    since: SINCE,
    total_revenue: Math.round(total),
    unmatched_revenue: Math.round(unmatched),
    top10_share: total ? Math.round((top10 / total) * 100) : 0,
    products_active: active.length,
    no_image: active.filter((p) => !p.image_url).length,
    no_category: active.filter((p) => !String(p.category || "").trim()).length,
    duplicate_names: Object.entries(names)
      .filter(([, n]) => n > 1)
      .map(([k]) => active.find((p) => String(p.name || "").trim().toLowerCase() === k).name),
    no_family: active.filter((p) => !familyOf(p.name)).map((p) => p.name),
    lines_without_catalog: own.filter((l) => !l.catalog_product_id).length,
    lines: own.length,
  };
  return { meta, families };
}

const create = (db, { log = console } = {}) => {
  const written = new Map();
  let timer = null;

  const all = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  // One doc failing (e.g. too big) must not stop the others.
  const put = async (id, doc) => {
    const json = JSON.stringify(doc);
    if (written.get(id) === json) return false;
    if (json.length > 900 * 1024) {
      log.error(`Guide facts: ${id} too big (${json.length} bytes), skipped`);
      return false;
    }
    try {
      await db.collection("guide_facts").doc(id).set({ ...doc, updated_at: new Date().toISOString() });
      written.set(id, json);
      return true;
    } catch (err) {
      log.error(`Guide facts: ${id} not written`, err.message);
      return false;
    }
  };

  const run = async () => {
    try {
      const [orders, lines, customers, products] = await Promise.all(["orders", "order_products", "customers", "products"].map(all));
      const { meta, families } = computeFacts({ orders, lines, customers, products });
      let n = 0;
      for (const f of families) if (await put(f.key, f)) n++;
      if (await put("_meta", { ...meta, families: families.map((f) => f.key) })) n++;
      if (n) log.log(`Guide facts: ${n} docs written`);
    } catch (err) {
      log.error("Guide facts failed", err.message);
    }
  };

  const start = () => {
    void run();
    timer = setInterval(() => void run(), EVERY_MS);
    console.log("Guide facts started");
  };
  const stop = () => clearInterval(timer);
  return { start, stop, run };
};

module.exports = { create, computeFacts, familyOf, FAMILIES };
