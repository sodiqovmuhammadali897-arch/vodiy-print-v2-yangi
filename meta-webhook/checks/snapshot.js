// Business snapshot — read only, aggregates only. Run on the server by
// .github/workflows/snapshot.yml (or `node checks/snapshot.js sales kpi`
// from /opt/meta-webhook). Prints counts and sums by month, manager,
// status, stage and product — never a customer's name, phone or note —
// so its output may go to GitHub Actions logs.
//
// Sections: sales, managers, kpi, debt, cost, amo, products (default: all).
const path = require("path");

const SECTIONS = ["sales", "managers", "kpi", "debt", "cost", "amo", "products", "productfacts", "guide", "guidejson", "funnel", "proposals", "calls"];
const SYSTEM_FROM = "2026-07"; // the ERP is used for every order from July 2026
const COST_FROM = "2026-09"; // costs are typed per line from September 2026

const key = (s) => String(s || "").trim().toLowerCase();
const mln = (n) => (Math.round((Number(n) || 0) / 1e5) / 10).toFixed(1);
const monthOfOrder = (o) => String(o.order_date || o.created_at || "").slice(0, 7);
const isSale = (o) => o.status !== "cancelled" && !o.is_draft;
const debtOf = (o) => Number(o.remaining_amount || 0) || Math.max(0, Number(o.total_amount || 0) - Number(o.paid_amount || 0));
const table = (out, title, rows) => {
  out.push(`== ${title}`);
  for (const r of rows) out.push(r);
};

function sales(d, out) {
  const live = d.orders.filter(isSale);
  const by = {};
  for (const o of live) {
    const m = monthOfOrder(o);
    const r = (by[m] = by[m] || { n: 0, rev: 0, paid: 0, debt: 0 });
    r.n++;
    r.rev += Number(o.total_amount || 0);
    r.paid += Number(o.paid_amount || 0);
    r.debt += debtOf(o);
  }
  table(out, `sales by month (mln) — reliable from ${SYSTEM_FROM}`, Object.keys(by).sort().map((m) => `${m}${m < SYSTEM_FROM ? " (import)" : ""} | orders ${by[m].n} | revenue ${mln(by[m].rev)} | paid ${mln(by[m].paid)} | debt ${mln(by[m].debt)}`));
  const names = new Set(d.managers.map((m) => key(m.name)));
  const bm = {};
  for (const o of live) {
    const m = monthOfOrder(o);
    if (m < SYSTEM_FROM) continue;
    const who = String(o.manager_name || "").trim() || "(bo'sh)";
    const r = (bm[`${m}|${who}`] = bm[`${m}|${who}`] || { n: 0, rev: 0 });
    r.n++;
    r.rev += Number(o.total_amount || 0);
  }
  table(
    out,
    `sales by month and manager_name since ${SYSTEM_FROM} (* = not in Managerlar)`,
    Object.keys(bm)
      .sort()
      .map((k) => {
        const [m, who] = k.split("|");
        return `${m} | ${who}${names.has(key(who)) ? "" : " *"} | ${bm[k].n} | ${mln(bm[k].rev)}`;
      }),
  );
}

function managers(d, out) {
  table(out, "managers (Managerlar)", d.managers.map((m) => `${m.id} | ${m.name} | plan ${mln(m.monthly_plan)} | rates ${m.sales_rate ?? "-"} / ${m.collect_rate ?? "-"}`));
  const byId = new Map(d.managers.map((m) => [m.id, m.name]));
  table(
    out,
    "staff linked to a manager / amoCRM (names only)",
    d.staff
      .filter((s) => s.report_manager_id || s.amo_user_id)
      .map((s) => `${s.full_name || "—"} | role ${s.role || "-"} | manager ${byId.get(s.report_manager_id) || "-"} | amo ${s.amo_user_id || "-"} | telegram ${s.telegram_chat_id ? "yes" : "no"}`),
  );
}

function kpi(d, out, lib) {
  if (!lib) return out.push("== kpi: salesKpi.js not found");
  const salesBy = new Map(d.kpi_sales.map((s) => [s.id, s]));
  const monthBy = new Map(d.kpi_months.map((m) => [m.id, m]));
  const rows = [];
  const data = { orders: d.orders, payments: d.order_payments, managers: d.managers };
  for (const month of lib.monthsWithData(data, d.now)) {
    if (month < SYSTEM_FROM) continue;
    for (const s of lib.summarize({ ...data, month })) {
      const doc = salesBy.get(s.id);
      const k = monthBy.get(s.id);
      if (!s.sales && !s.collected && !k) continue;
      const snap = k && k.snapshot;
      const stale = snap && (Math.abs(snap.sales - s.sales) >= 1000 || Math.abs(snap.collected - s.collected) >= 1000);
      rows.push(
        `${month} ${s.manager_name} | now ${mln(s.sales)} / ${mln(s.collected)} (${s.order_count}) | doc ${doc ? `${mln(doc.sales)} / ${mln(doc.collected)}` : "—"} | ${k ? k.status : "open"}${snap ? ` snap ${mln(snap.sales)} / ${mln(snap.collected)} payout ${Math.round(snap.payout)}` : ""}${stale ? " STALE" : ""}${k && k.paid_before ? ` paid_before ${Math.round(k.paid_before)}` : ""}`,
      );
    }
  }
  table(out, "kpi: sales / collected (mln) — live vs kpi_sales vs kpi_months", rows);
}

function debt(d, out) {
  const by = {};
  for (const o of d.orders.filter(isSale)) {
    const x = debtOf(o);
    if (x <= 0) continue;
    const k = `${o.status || "-"} | ${String(o.manager_name || "").trim() || "(bo'sh)"}`;
    const r = (by[k] = by[k] || { n: 0, sum: 0 });
    r.n++;
    r.sum += x;
  }
  table(out, "debt by status | manager (orders, mln)", Object.entries(by).sort((a, b) => b[1].sum - a[1].sum).map(([k, r]) => `${k} | ${r.n} | ${mln(r.sum)}`));
}

function cost(d, out) {
  const live = new Map(d.orders.filter(isSale).map((o) => [o.id, o]));
  const costBy = new Map();
  for (const c of d.order_costs) {
    const id = c.order_id || String(c.id).replace(/^order_/, "").replace(/_L\d+$/, "");
    if (live.has(id)) costBy.set(id, (costBy.get(id) || 0) + Number(c.total_cost || 0));
  }
  const by = {};
  for (const o of live.values()) {
    const m = monthOfOrder(o);
    if (m < SYSTEM_FROM) continue;
    const r = (by[m] = by[m] || { n: 0, rev: 0, cn: 0, crev: 0, cost: 0 });
    r.n++;
    r.rev += Number(o.total_amount || 0);
    if (costBy.has(o.id)) {
      r.cn++;
      r.crev += Number(o.total_amount || 0);
      r.cost += costBy.get(o.id);
    }
  }
  table(
    out,
    `cost coverage — costs are typed from ${COST_FROM}`,
    Object.keys(by)
      .sort()
      .map((m) => {
        const r = by[m];
        return `${m}${m < COST_FROM ? " (not tracked)" : ""} | orders ${r.cn}/${r.n} | revenue ${mln(r.crev)}/${mln(r.rev)} | margin ${r.crev ? `${Math.round((1 - r.cost / r.crev) * 1000) / 10}%` : "-"}`;
      }),
  );
}

function amo(d, out) {
  const st = d.amo_status || {};
  const statuses = st.statuses || {};
  const cur = new Date(d.now + 5 * 3600e3).toISOString().slice(0, 7);
  const open = {};
  for (const s of d.amo_stats) if (s.month === cur) for (const [k, n] of Object.entries(s.funnel || {})) open[k] = (open[k] || 0) + n;
  out.push(`== amo users: ${(st.users || []).map((u) => `${u.id}=${u.name}`).join(", ")}`);
  table(
    out,
    "amo stages (pipeline | stage | key | open now)",
    Object.entries(statuses)
      .sort((a, b) => (a[1].pipeline_sort || 0) - (b[1].pipeline_sort || 0) || (a[1].sort || 0) - (b[1].sort || 0))
      .map(([k, v]) => `${v.pipeline} | ${v.name} | ${k} | ${open[k] || 0}`),
  );
  const by = {};
  const loss = {};
  for (const s of d.amo_stats) {
    const r = (by[s.month] = by[s.month] || { c: 0, w: 0, l: 0, a: 0 });
    const L = s.leads || {};
    r.c += L.created || 0;
    r.w += L.won || 0;
    r.l += L.lost || 0;
    r.a += L.won_amount || 0;
    for (const [why, n] of Object.entries(s.loss || {})) loss[why] = (loss[why] || 0) + n;
  }
  table(out, "amo leads by month (created / won / lost / won mln)", Object.keys(by).sort().map((m) => `${m} | ${by[m].c} / ${by[m].w} / ${by[m].l} / ${mln(by[m].a)}`));
  table(out, "amo loss reasons (all months)", Object.entries(loss).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}: ${n}`));
}

function products(d, out) {
  const act = d.products.filter((p) => p.is_active !== false && !p.archived_at);
  const filled = (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.values(v).some((x) => (Array.isArray(x) ? x.length : x)) : String(v ?? "").trim() !== "" && Number(v) !== 0);
  const F = ["image_url", "description", "advantages", "recommended_for", "sales_notes", "manager_tip", "upsell_product_ids", "spin", "price_tiers", "min_order_qty", "lead_time_days", "size_spec", "material", "print_type"];
  table(out, `product cards: filled / ${act.length} active`, F.map((f) => `${f}: ${act.filter((p) => filled(p[f])).length}`));
  const cats = {};
  for (const p of act) cats[p.category || "(toifasiz)"] = (cats[p.category || "(toifasiz)"] || 0) + 1;
  table(out, "products by category", Object.entries(cats).map(([c, n]) => `${c}: ${n}`));
  const live = new Map(d.orders.filter((o) => isSale(o) && monthOfOrder(o) >= SYSTEM_FROM).map((o) => [o.id, o]));
  const by = {};
  for (const l of d.order_products) {
    if (!live.has(l.order_id)) continue;
    const k = String(l.product_name || "—").split("(")[0].trim();
    const r = (by[k] = by[k] || { o: new Set(), s: 0 });
    r.o.add(l.order_id);
    r.s += Number(l.total || 0);
  }
  const rows = Object.entries(by).sort((a, b) => b[1].s - a[1].s);
  const tot = rows.reduce((s, [, r]) => s + r.s, 0) || 1;
  let acc = 0;
  table(
    out,
    `top products since ${SYSTEM_FROM} (orders, mln, cumulative share) — ${rows.length} distinct line names`,
    rows.slice(0, 25).map(([k, r]) => {
      acc += r.s;
      return `${k}: ${r.o.size}, ${mln(r.s)} (${Math.round((acc / tot) * 100)}%)`;
    }),
  );
}

// Product families by the typed line name (lines are free text).
const FAMILIES = [
  ["gift box", /gift|sovg|quti|box|set/],
  ["paket", /paket|пакет/],
  ["bloknot", /bloknot|blaknot|ежедн|kundalik|daftar/],
  ["futbolka", /futbol|polo/],
  ["kepka", /kepka|кепк|panama/],
  ["ustki kiyim", /nimcha|bomber|finka|xudi|hudi|kurtka|svitshot|jilet/],
  ["bakal", /bakal|kruj|stakan|termos|кружк/],
  ["ruchka", /ruchka|ручк|qalam/],
  ["papka", /papka|папк/],
  ["flayer / buklet", /flayer|flyer|listovka|buklet|лист/],
  ["vizitka", /vizit|визит/],
  ["katalog / jurnal", /katalog|jurnal|broshyura|kitob/],
  ["kalendar", /kalendar|календ/],
  ["stiker / yorliq", /stiker|sticker|yorliq|etiketka|наклей/],
  ["banner / roll-up", /banner|roll|баннер|tent|vinil/],
  ["blank / konvert", /blank|konvert|бланк|конверт|sertifikat|diplom|gramota/],
  ["kovrik / suvenir", /kovrik|brelok|znachok|flesh|usb|soat|suvenir|медал|medal/],
];
const familyOf = (name) => {
  const n = String(name || "").toLowerCase();
  for (const [f, re] of FAMILIES) if (re.test(n)) return f;
  return null;
};
const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  return a.length ? a[Math.floor((a.length - 1) / 2)] : 0;
};
const q = (xs, p) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((m, n) => m - n);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
};
const top = (counts, n = 4) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} ${c}`).join(", ");
const clip = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 28);

// Facts for the sales guide, per product family since July 2026: how it
// sells (orders, buyers, repeat buyers, quantity, unit price, line total),
// who buys it (customer industry), what it is bought with, and the
// variants/sizes/materials typed most. Then the catalog products, one line
// each (name, category, image, lead time, min qty, price tiers).
function productfacts(d, out) {
  const live = new Map(d.orders.filter((o) => isSale(o) && monthOfOrder(o) >= SYSTEM_FROM).map((o) => [o.id, o]));
  const cust = new Map(d.customers.map((c) => [c.id, c]));
  const famsOfOrder = new Map();
  const lines = d.order_products.filter((l) => live.has(l.order_id));
  for (const l of lines) {
    const f = familyOf(l.product_name);
    if (!f) continue;
    if (!famsOfOrder.has(l.order_id)) famsOfOrder.set(l.order_id, new Set());
    famsOfOrder.get(l.order_id).add(f);
  }
  const by = {};
  let unmatched = 0;
  for (const l of lines) {
    const f = familyOf(l.product_name);
    if (!f) {
      unmatched += Number(l.total || 0);
      continue;
    }
    const o = live.get(l.order_id);
    const r = (by[f] = by[f] || { orders: new Set(), buyers: {}, qty: [], unit: [], total: [], sum: 0, ind: {}, with: {}, spec: {}, months: {} });
    r.orders.add(l.order_id);
    if (o.customer_id) r.buyers[o.customer_id] = (r.buyers[o.customer_id] || new Set()).add(l.order_id);
    r.qty.push(Number(l.quantity || 0));
    r.unit.push(Number(l.unit_price || 0));
    r.total.push(Number(l.total || 0));
    r.sum += Number(l.total || 0);
    const c = o.customer_id && cust.get(o.customer_id);
    const ind = clip(c && c.industry) || "(soha yo'q)";
    r.ind[ind] = (r.ind[ind] || 0) + 1;
    for (const g of famsOfOrder.get(l.order_id) || []) if (g !== f) r.with[g] = (r.with[g] || 0) + 1;
    const spec = [l.variant, l.size, l.material].map(clip).filter(Boolean).join(" / ");
    if (spec) r.spec[spec] = (r.spec[spec] || 0) + 1;
    const m = monthOfOrder(o);
    r.months[m] = (r.months[m] || 0) + Number(l.total || 0);
  }
  const rows = Object.entries(by).sort((a, b) => b[1].sum - a[1].sum);
  out.push(`== product families since ${SYSTEM_FROM} (by typed line name); not matched: ${mln(unmatched)} mln`);
  for (const [f, r] of rows) {
    const buyers = Object.values(r.buyers);
    out.push(`-- ${f}: ${r.orders.size} orders, ${mln(r.sum)} mln, ${buyers.length} buyers (${buyers.filter((s) => s.size > 1).length} bought again)`);
    out.push(`   qty median ${median(r.qty)} (25–75%: ${q(r.qty, 0.25)}–${q(r.qty, 0.75)}) | unit price median ${Math.round(median(r.unit))} | line median ${mln(median(r.total))} mln`);
    out.push(`   who: ${top(r.ind)}`);
    out.push(`   with: ${top(r.with, 5) || "—"}`);
    out.push(`   typed: ${top(r.spec, 4) || "—"}`);
    out.push(`   months: ${Object.keys(r.months).sort().map((m) => `${m.slice(5)} ${mln(r.months[m])}`).join(", ")}`);
  }
  const act = d.products.filter((p) => p.is_active !== false && !p.archived_at);
  table(
    out,
    "catalog: name | category | family | image | lead days | min qty | tiers (qty:price)",
    act
      .sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")) || String(a.name).localeCompare(String(b.name)))
      .map((p) => `${p.name} | ${p.category || "-"} | ${familyOf(p.name) || "-"} | ${p.image_url ? "rasm" : "—"} | ${p.lead_time_days || "-"} | ${p.min_order_qty || "-"} | ${(p.price_tiers || []).map((t) => `${t.min_qty}:${Math.round(t.price)}`).join(" ")}`),
  );
}

// What the server wrote for the Mahsulot qo'llanmasi (guideFacts.js).
function guide(d, out) {
  const meta = d.guide_facts.find((g) => g.id === "_meta");
  const fams = d.guide_facts.filter((g) => g.id !== "_meta").sort((a, b) => a.rank - b.rank);
  out.push(`== guide_facts: ${fams.length} families, updated ${meta ? meta.updated_at : "—"}, top10 share ${meta ? meta.top10_share : "-"}%`);
  for (const f of fams) out.push(`${f.rank}. ${f.key} | ${f.orders} orders, ${mln(f.revenue)} mln | models ${f.models.length} | lesson ${f.lesson}`);
  if (meta) out.push(`gaps: no image ${meta.no_image}, no category ${meta.no_category}, duplicates ${meta.duplicate_names.join(", ") || "-"}, lines typed by hand ${meta.lines_without_catalog}/${meta.lines}`);
}

// The guide's docs in full (counts, sums, catalog models — no customer
// data) and the Darslik lesson edits, one JSON line each, for the printed
// guide.
function guidejson(d, out) {
  out.push("== guidejson");
  for (const g of d.guide_facts) out.push(`GF ${JSON.stringify(g)}`);
  for (const l of d.lessons) out.push(`LS ${JSON.stringify(l)}`);
}

// What the server wrote for the Voronka (amoFunnel.js), per month.
function funnel(d, out) {
  out.push("== amo_funnel: month | leads talked info offer won lost(no reason) ordered paid | first call min, lead→order days | stuck, unused, erp/won");
  for (const f of [...d.amo_funnel].sort((a, b) => a.id.localeCompare(b.id))) {
    const a = f.all || {};
    const r = a.reached || {};
    out.push(
      `${f.id} | ${a.leads} ${a.talked ?? "-"} ${f.info_key ? r[f.info_key] || 0 : "-"} ${f.offer_key ? r[f.offer_key] || 0 : "-"} ${a.won} ${a.lost}(${a.lost_no_reason}) ${a.ordered} ${a.paid} | ${a.first_call_min ?? "-"}, ${a.lead_to_order_days ?? "-"} | ${f.hygiene.stuck_first_stage}, ${f.hygiene.unused_stages.join("/") || "-"}, ${f.hygiene.erp_orders}/${f.hygiene.amo_won} | users ${f.users.map((u) => `${u.name}:${u.leads}/${u.ordered}`).join(" ")} | ${f.updated_at}`,
    );
  }
}

// Tijorat takliflari: how many per month, with a customer, how big, which
// fields are filled, and how many customers ordered within 30 days.
function proposals(d, out) {
  const ps = d.proposals;
  const orderDays = new Map();
  for (const o of d.orders.filter(isSale)) {
    if (!o.customer_id) continue;
    if (!orderDays.has(o.customer_id)) orderDays.set(o.customer_id, []);
    orderDays.get(o.customer_id).push({ day: monthOfOrder(o).length ? String(o.order_date || o.created_at || "").slice(0, 10) : "", sum: Number(o.total_amount || 0) });
  }
  const by = {};
  for (const p of ps) {
    const m = String(p.created_at || "").slice(0, 7) || "(sanasiz)";
    const r = (by[m] = by[m] || { n: 0, cust: 0, sum: 0, won: 0, wonSum: 0, items: 0 });
    r.n++;
    r.sum += Number(p.total || 0);
    r.items += (p.items || []).length;
    if (!p.customer_id) continue;
    r.cust++;
    const day = String(p.created_at || "").slice(0, 10);
    const to = new Date(Date.parse(day) + 30 * 86400e3).toISOString().slice(0, 10);
    const hit = (orderDays.get(p.customer_id) || []).filter((o) => o.day >= day && o.day <= to);
    if (hit.length) {
      r.won++;
      r.wonSum += hit[0].sum;
    }
  }
  table(out, `proposals: ${ps.length} total — month | count | with customer | sum mln | avg items | customer ordered within 30 days (sum mln)`, Object.keys(by).sort().map((m) => `${m} | ${by[m].n} | ${by[m].cust} | ${mln(by[m].sum)} | ${(by[m].items / by[m].n).toFixed(1)} | ${by[m].won} (${mln(by[m].wonSum)})`));
  const fields = {};
  for (const p of ps) for (const k of Object.keys(p)) fields[k] = (fields[k] || 0) + 1;
  out.push(`fields: ${Object.entries(fields).map(([k, n]) => `${k}=${n}`).join(" ")}`);
}

// Mois Zvonki calls (calls collection): per month, how many were
// answered, how many have a recording, and how many are 60+ s with one;
// and which AI keys the server has (names only, never values).
function calls(d, out) {
  const by = {};
  let last = "";
  for (const c of d.calls) {
    const t = String(c.start_time || c.created_at || "");
    const m = t.slice(0, 7) || "(sanasiz)";
    if (t > last) last = t;
    const r = (by[m] = by[m] || { n: 0, ans: 0, rec: 0, rec60: 0, out: 0 });
    r.n++;
    if (c.answered) r.ans++;
    if (c.direction === "out") r.out++;
    if (c.recording_url) r.rec++;
    if (c.recording_url && Number(c.duration_seconds || 0) >= 60) r.rec60++;
  }
  table(out, `calls (Mois Zvonki): ${d.calls.length} total, last ${last || "—"} — month | calls | answered | outgoing | with recording | recording 60+ s`, Object.keys(by).sort().map((m) => `${m} | ${by[m].n} | ${by[m].ans} | ${by[m].out} | ${by[m].rec} | ${by[m].rec60}`));
  out.push(`server keys set: ${(d.env_keys || []).join(", ") || "—"}`);
}

const RUN = { sales, managers, kpi, debt, cost, amo, products, productfacts, guide, guidejson, funnel, proposals, calls };

// The report for already loaded data; `lib` is meta-webhook/salesKpi.js.
function report(d, wanted = SECTIONS, lib = null) {
  const out = [];
  for (const s of wanted) {
    if (!RUN[s]) {
      out.push(`== unknown section: ${s} (${SECTIONS.join(", ")})`);
      continue;
    }
    RUN[s](d, out, lib);
  }
  return out;
}

const NEEDS = {
  sales: ["orders", "managers"],
  managers: ["managers", "staff"],
  kpi: ["orders", "order_payments", "managers", "kpi_sales", "kpi_months"],
  debt: ["orders"],
  cost: ["orders", "order_costs"],
  amo: ["amo_stats"],
  products: ["products", "orders", "order_products"],
  productfacts: ["products", "orders", "order_products", "customers"],
  guide: ["guide_facts"],
  guidejson: ["guide_facts", "lessons"],
  funnel: ["amo_funnel"],
  proposals: ["proposals", "orders"],
  calls: ["calls"],
};

async function main() {
  const base = path.resolve(__dirname, "..");
  const admin = require(path.join(base, "node_modules/firebase-admin"));
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(base, "service-account.json"))) });
  const db = admin.firestore();
  const args = process.argv.slice(2).flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
  const wanted = !args.length || args.includes("all") ? SECTIONS : args;
  const cols = [...new Set(wanted.flatMap((s) => NEEDS[s] || []))];
  const d = { now: Date.now(), orders: [], order_payments: [], order_products: [], order_costs: [], managers: [], staff: [], kpi_sales: [], kpi_months: [], products: [], amo_stats: [], customers: [], guide_facts: [], lessons: [], amo_funnel: [], proposals: [], calls: [] };
  // Which keys the server's .env has (names of the non-empty ones only).
  try {
    const env = require("fs").readFileSync(path.join(base, ".env"), "utf8");
    d.env_keys = env
      .split("\n")
      .map((l) => l.match(/^([A-Z_]*(?:API_KEY|TOKEN|MODEL|AGENTS)[A-Z_]*)=(.+)$/))
      .filter(Boolean)
      .map((m) => (/MODEL|AGENTS/.test(m[1]) ? `${m[1]}=${m[2].trim()}` : m[1]));
  } catch {
    d.env_keys = [];
  }
  await Promise.all(cols.map(async (c) => (d[c] = (await db.collection(c).get()).docs.map((x) => ({ id: x.id, ...x.data() })))));
  if (wanted.includes("amo")) d.amo_status = (await db.collection("amo_meta").doc("status").get()).data() || {};
  let lib = null;
  try {
    lib = require(path.join(base, "salesKpi"));
  } catch {
    lib = null;
  }
  console.log(`snapshot ${new Date(d.now + 5 * 3600e3).toISOString().slice(0, 16)} (Toshkent) — ${wanted.join(", ")}`);
  for (const line of report(d, wanted, lib)) console.log(line);
}

if (require.main === module)
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });

module.exports = { report, SECTIONS };
