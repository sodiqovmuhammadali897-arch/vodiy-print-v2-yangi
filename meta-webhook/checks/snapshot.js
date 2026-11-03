// Business snapshot — read only, aggregates only. Run on the server by
// .github/workflows/snapshot.yml (or `node checks/snapshot.js sales kpi`
// from /opt/meta-webhook). Prints counts and sums by month, manager,
// status, stage and product — never a customer's name, phone or note —
// so its output may go to GitHub Actions logs.
//
// Sections: sales, managers, kpi, debt, cost, amo, products (default: all).
const path = require("path");

const SECTIONS = ["sales", "managers", "kpi", "debt", "cost", "amo", "products"];
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

const RUN = { sales, managers, kpi, debt, cost, amo, products };

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
};

async function main() {
  const base = path.resolve(__dirname, "..");
  const admin = require(path.join(base, "node_modules/firebase-admin"));
  admin.initializeApp({ credential: admin.credential.cert(require(path.join(base, "service-account.json"))) });
  const db = admin.firestore();
  const args = process.argv.slice(2).flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
  const wanted = !args.length || args.includes("all") ? SECTIONS : args;
  const cols = [...new Set(wanted.flatMap((s) => NEEDS[s] || []))];
  const d = { now: Date.now(), orders: [], order_payments: [], order_products: [], order_costs: [], managers: [], staff: [], kpi_sales: [], kpi_months: [], products: [], amo_stats: [] };
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
