import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, GraduationCap, Lightbulb, Pencil, Sparkles } from "lucide-react";
import type { Customer, Order, OrderProduct, Product } from "../../lib/types";
import { listAll, listWhere, updateOne } from "../../lib/firestoreDb";
import { formatMoneyShort } from "../../lib/format";
import { guideFor, SPIN_KEYS, SPIN_LABELS, toLines, whoBuys, type Spin, type WhoBuys } from "../../lib/salesGuide";
import Modal from "../../components/ui/Modal";
import { lessonFor } from "./ProductSheet";

// "Sotuvchi uchun": everything a seller needs about the product in four
// tabs — its features (the owner writes them), who buys it (from orders),
// why Vodiy Print, and the SPIN questions. A product without its own
// advantages or SPIN questions shows the suggestion of its kind, marked so.

type Tab = "about" | "who" | "usp" | "spin";
const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "Xususiyati" },
  { key: "who", label: "Kim oladi" },
  { key: "usp", label: "Noyob tomoni" },
  { key: "spin", label: "SPIN" },
];
const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
const SPIN_STYLE: Record<keyof Spin, string> = {
  s: "bg-emerald-900 text-white",
  p: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100",
  i: "bg-orange-700 text-white",
  n: "bg-lime-300 text-lime-950",
};

type Props = {
  product: Product;
  allProducts: Product[];
  canEdit: boolean;
  onSelectUpsell?: (p: Product) => void;
  onSaved?: () => void;
};

const Suggested = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
    <Sparkles className="h-3 w-3" /> Taklif — tahrirlang
  </span>
);

export default function SalesGuide({ product, allProducts, canEdit, onSelectUpsell, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>("about");
  const [editing, setEditing] = useState(false);
  const guide = guideFor(product);
  const lesson = lessonFor(product);
  const upsell = (product.upsell_product_ids || []).map((id) => allProducts.find((p) => p.id === id)).filter((p): p is Product => !!p);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GraduationCap className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-bold text-ink-900">Sotuvchi uchun</h2>
        <span className="text-xs text-ink-500">· {guide.kind.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {lesson && (
            <Link to={`/darslik/${lesson.key}`} className="btn-secondary !px-3 !py-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Darslik
            </Link>
          )}
          {canEdit && (
            <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
            </button>
          )}
        </div>
      </div>

      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${tab === t.key ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "about" && (
        <div className="space-y-4">
          {product.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{product.description}</p>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-200 px-4 py-5 text-center text-sm text-ink-500">
              Rahbar bu mahsulotning to'liq xususiyatini hali yozmagan.
              {canEdit && (
                <button className="mt-2 block w-full font-semibold text-brand-600" onClick={() => setEditing(true)}>
                  Hozir yozish
                </button>
              )}
            </div>
          )}
          {product.recommended_for?.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Tavsiya etiladigan sohalar</div>
              <div className="flex flex-wrap gap-1.5">
                {product.recommended_for.map((r) => (
                  <span key={r} className="chip bg-ink-100 text-ink-700">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          {product.sales_notes && (
            <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Muhim sotuv izohlari</div>
              {product.sales_notes}
            </div>
          )}
          {product.manager_tip && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Menejer uchun tavsiya</div>
                {product.manager_tip}
              </div>
            </div>
          )}
          {upsell.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qo'shib taklif qiling</div>
              <div className="flex flex-wrap gap-1.5">
                {upsell.map((p) => (
                  <button key={p.id} onClick={() => onSelectUpsell?.(p)} className="chip bg-brand-50 text-brand-700 hover:bg-brand-100">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "who" && <WhoBuysTab product={product} />}

      {tab === "usp" && (
        <div className="space-y-2">
          {guide.uspSuggested && <Suggested />}
          <ul className="space-y-2">
            {guide.usp.map((u, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "spin" && (
        <div className="space-y-3">
          {guide.spinSuggested && <Suggested />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SPIN_KEYS.map((k) => (
              <div key={k} className={`rounded-2xl p-4 ${SPIN_STYLE[k]}`}>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold leading-none">{SPIN_LABELS[k].letter}</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{SPIN_LABELS[k].name}</span>
                  <span className="text-[11px] opacity-75">· {SPIN_LABELS[k].hint}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-snug">
                  {guide.spin[k].length ? guide.spin[k].map((q, i) => <li key={i}>{q}</li>) : <li className="list-none opacity-70">—</li>}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-500">Tartib: avval S, keyin P, I va N — narxni N dan keyin ayting.</p>
        </div>
      )}

      {editing && (
        <GuideEditor
          product={product}
          spin={guide.spin}
          usp={guide.usp}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}

function WhoBuysTab({ product }: { product: Product }) {
  const [data, setData] = useState<{ w: WhoBuys; names: Map<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    setData(null);
    setFailed(false);
    void Promise.all([
      listWhere<OrderProduct>("order_products", "product_name", product.name),
      listAll<Order>("orders"),
      listAll<Customer>("customers").catch(() => [] as Customer[]),
    ])
      .then(([lines, orders, customers]) => {
        if (off) return;
        const names = new Map<string, string>(customers.map((c): [string, string] => [c.id, c.company || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Mijoz"]));
        setData({ w: whoBuys(lines, orders), names });
      })
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [product.id, product.name]);

  const maxMonth = useMemo(() => Math.max(1, ...(data?.w.months || [])), [data]);
  if (failed) return <p className="text-sm text-ink-500">Buyurtmalarni ko'rishga ruxsat yo'q.</p>;
  if (!data) return <div className="h-32 animate-pulse rounded-2xl bg-ink-100/70" />;
  const { w, names } = data;
  if (!w.orders) return <p className="text-sm text-ink-500">Bu mahsulot bo'yicha hali buyurtma yo'q.</p>;
  const tiles = [
    { v: String(w.orders), k: "buyurtma" },
    { v: w.typicalQty !== null ? `${w.typicalQty}` : "—", k: "odatdagi tiraj" },
    { v: w.avgSum !== null ? formatMoneyShort(w.avgSum) : "—", k: "o'rtacha summa" },
    { v: w.customers ? `${Math.round((w.repeatCustomers / w.customers) * 100)}%` : "—", k: `qayta olgan (${w.repeatCustomers}/${w.customers})` },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.k} className="rounded-xl bg-ink-50 px-3 py-2.5">
            <div className="font-display text-lg font-extrabold tabular-nums text-ink-900">{t.v}</div>
            <div className="text-[11px] text-ink-500">{t.k}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Qaysi oylarda olishadi</div>
        <div className="flex h-16 items-end gap-1">
          {w.months.map((n, i) => (
            <div key={i} title={`${MONTHS[i]}: ${n}`} className={`flex-1 rounded-t ${n === maxMonth ? "bg-brand-600" : "bg-brand-200 dark:bg-brand-900"}`} style={{ height: `${Math.max(4, (n / maxMonth) * 100)}%` }} />
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {MONTHS.map((m) => (
            <span key={m} className="flex-1 text-center text-[10px] text-ink-400">
              {m}
            </span>
          ))}
        </div>
      </div>
      {w.top.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Eng ko'p olganlar — o'xshash mijozlarga taklif qiling</div>
          <ul className="divide-y divide-ink-100 text-sm">
            {w.top.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5">
                <span className="truncate text-ink-800">{names.get(t.id) || "Mijoz"}</span>
                <span className="shrink-0 tabular-nums text-ink-500">
                  {t.orders} marta · {formatMoneyShort(t.sum)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GuideEditor({ product, spin, usp, onClose, onSaved }: { product: Product; spin: Spin; usp: string[]; onClose: () => void; onSaved: () => void }) {
  const [about, setAbout] = useState(product.description || "");
  const [adv, setAdv] = useState(usp.join("\n"));
  const [qs, setQs] = useState<Record<keyof Spin, string>>({ s: spin.s.join("\n"), p: spin.p.join("\n"), i: spin.i.join("\n"), n: spin.n.join("\n") });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateOne("products", product.id, {
        description: about.trim(),
        advantages: toLines(adv),
        spin: { s: toLines(qs.s), p: toLines(qs.p), i: toLines(qs.i), n: toLines(qs.n) },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sotuvchi uchun · ${product.name}`}
      size="lg"
      footer={
        <>
          {error && <span className="mr-auto text-sm text-rose-600">{error}</span>}
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="label">To'liq xususiyati</span>
          <textarea className="input min-h-[140px]" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Nima ekani, material, sifati, qayerda ishlatiladi, nimasi bilan yaxshi…" />
        </label>
        <label className="block">
          <span className="label">Noyob tomoni — nega aynan Vodiy Print (har qatorga bittadan)</span>
          <textarea className="input min-h-[90px]" value={adv} onChange={(e) => setAdv(e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SPIN_KEYS.map((k) => (
            <label key={k} className="block">
              <span className="label">
                {SPIN_LABELS[k].letter} · {SPIN_LABELS[k].name} savollari (har qatorga bittadan)
              </span>
              <textarea className="input min-h-[96px]" value={qs[k]} onChange={(e) => setQs((q) => ({ ...q, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
