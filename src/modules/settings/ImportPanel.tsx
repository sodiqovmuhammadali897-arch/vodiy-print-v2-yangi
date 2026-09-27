import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader, RotateCcw, Upload } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { parseWorkbook, type SheetInput } from "../../lib/excelImport";
import { planImport, runImport, undoImport, type ImportBatch, type ImportPlan, type ImportProgress, type PaidMode } from "../../lib/importService";

const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="rounded-xl bg-ink-50 px-4 py-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
    <div className="mt-0.5 font-display text-xl font-bold tabular-nums text-ink-900">{value}</div>
    {sub && <div className="text-xs text-ink-500">{sub}</div>}
  </div>
);

const STATUS: Record<ImportBatch["status"], { text: string; cls: string }> = {
  running: { text: "Kiritilmoqda", cls: "bg-amber-50 text-amber-800" },
  done: { text: "Kiritildi", cls: "bg-emerald-50 text-emerald-700" },
  failed: { text: "Xato bilan to'xtadi", cls: "bg-rose-50 text-rose-700" },
  undone: { text: "Qaytarildi", cls: "bg-ink-50 text-ink-600" },
};

// Sozlamalar → Excel import: brings the pre-ERP order spreadsheet in as
// archive orders, customers and products (src/lib/importService.ts).
export default function ImportPanel() {
  const { user, staff } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [paidMode, setPaidMode] = useState<PaidMode>("paid");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "import_batches"), orderBy("created_at", "desc"), limit(20));
    return onSnapshot(
      q,
      (snap) => setBatches(snap.docs.map((d) => ({ ...(d.data() as ImportBatch), id: d.id }))),
      () => setBatches([]),
    );
  }, []);

  const readFile = async (file: File) => {
    setError(null);
    setResult(null);
    setPlan(null);
    setFileName(file.name);
    setReading(true);
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = (await readXlsxFile(file)) as unknown as SheetInput[];
      const parsed = parseWorkbook(sheets);
      if (!parsed.orders.length && !parsed.products.length) {
        throw new Error("Faylda buyurtmalar jadvali topilmadi. Sarlavhada «Sana», «Ism» yoki «Nomer», «Mahsulot» va «Jami summa» ustunlari bo'lishi kerak.");
      }
      setPlan(await planImport(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const run = async () => {
    if (!plan) return;
    setRunning(true);
    setError(null);
    setProgress({ done: 0, total: 1, label: "Boshlanmoqda" });
    try {
      const b = await runImport(plan, {
        fileName,
        paidMode,
        actor: staff?.full_name || user?.email || "",
        onProgress: setProgress,
      });
      setResult(
        `✅ Kiritildi: ${b.orders_created} ta buyurtma (${formatMoney(b.total_amount)}), ${b.customers_created} ta yangi mijoz, ${b.brands_created} ta brend, ${b.products_created} ta mahsulot.`,
      );
      setPlan(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const undo = async (id: string) => {
    setConfirmUndo(null);
    setRunning(true);
    setError(null);
    try {
      const r = await undoImport(id, setProgress);
      setResult(
        `↩️ Qaytarildi: ${r.orders} ta buyurtma, ${r.customers} ta mijoz, ${r.products} ta mahsulot o'chirildi.` +
          (r.keptCustomers ? ` ${r.keptCustomers} ta mijoz qoldirildi — ularda keyin yangi buyurtmalar ochilgan.` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const p = plan?.parsed;
  const customerName = (key: string) => {
    const c = plan?.customers.find((x) => x.item.key === key);
    if (!c) return key;
    return c.existing ? `${c.existing.first_name} ${c.existing.last_name}`.trim() : `${c.item.first_name} ${c.item.last_name}`.trim();
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Eski ma'lumotlarni Excel'dan kiritish</h2>
          <p className="max-w-3xl text-sm text-ink-500">
            ERP'dan oldingi oborot faylini yuklang: buyurtmalar arxivga (yopilgan holda, o'z sanasi bilan), mijozlar bazaga, yangi mahsulotlar katalogga
            tushadi. Ishlab chiqarish, ombor va xabarnomalarga hech narsa ketmaydi. Kiritishdan oldin nima qo'shilishini ko'rasiz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
          <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={reading || running}>
            {reading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Excel fayl tanlash (.xlsx)
          </button>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> {fileName}
            </span>
          )}
        </div>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {result && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{result}</p>}
        {progress && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-ink-600">
              <span>{progress.label}</span>
              <span className="tabular-nums">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {plan && p && (
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-ink-900">Nima kiritiladi</h3>
            <span className="text-sm text-ink-500">
              Davr: <b className="text-ink-800">{p.date_from ? `${formatDate(p.date_from)} — ${formatDate(p.date_to)}` : "—"}</b> · varaq «{p.orders_sheet || "—"}»
              {p.catalog_sheet ? ` + «${p.catalog_sheet}»` : ""}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Buyurtmalar" value={plan.newOrders} sub={plan.duplicateOrders ? `${plan.duplicateOrders} tasi avval kiritilgan — o'tkaziladi` : `${p.orders.reduce((s, o) => s + o.lines.length, 0)} ta mahsulot qatori`} />
            <Stat label="Jami summa" value={formatMoney(plan.total)} sub={`Excel'da avans: ${formatMoney(plan.advance)}`} />
            <Stat label="Mijozlar" value={plan.customers.length} sub={`${plan.newCustomers} ta yangi, ${plan.customers.length - plan.newCustomers} tasi bazada bor`} />
            <Stat label="Mahsulotlar" value={plan.newProducts} sub={p.products.length ? `katalogdagi ${p.products.length} tadan yangilari` : "katalog varag'i yo'q"} />
          </div>

          {p.problems.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> {p.problems.length} ta qator kiritilmaydi
              </div>
              <ul className="space-y-0.5 text-ink-700">
                {p.problems.slice(0, 12).map((x) => (
                  <li key={`${x.sheet}-${x.row}`}>
                    «{x.sheet}» {x.row}-qator: {x.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink-800">To'lovlar</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" className="mt-0.5" checked={paidMode === "paid"} onChange={() => setPaidMode("paid")} />
              <span>
                <b>Hammasi to'langan</b> — har bir buyurtma to'liq to'langan deb, buyurtma sanasi bilan kiritiladi. Qarz chiqmaydi.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" className="mt-0.5" checked={paidMode === "excel"} onChange={() => setPaidMode("excel")} />
              <span>
                <b>Excel'dagidek</b> — faqat «Avans» ustunidagi summa to'langan, qolgani ({formatMoney(plan.total - plan.advance)}) mijozlar qarzi bo'lib qoladi.
              </span>
            </label>
          </fieldset>

          {plan.newProducts > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-brand-700">Katalogga qo'shiladigan {plan.newProducts} ta mahsulot</summary>
              <p className="mt-1 text-ink-700">
                {plan.products
                  .filter((x) => !x.existing)
                  .map((x) => x.item.name)
                  .join(", ")}
              </p>
              <p className="mt-1 text-xs text-ink-500">Nomi aynan bir xil bo'lgan mahsulotlar tizimda bor deb hisoblanadi va o'zgartirilmaydi.</p>
            </details>
          )}

          <div>
            <button className="text-sm font-semibold text-brand-700" onClick={() => setShowOrders((v) => !v)}>
              {showOrders ? "Buyurtmalar ro'yxatini yashirish" : `Buyurtmalar ro'yxatini ko'rish (${p.orders.length})`}
            </button>
            {showOrders && (
              <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-ink-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="px-3 py-2">Sana</th>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Mijoz</th>
                      <th className="px-3 py-2">Mahsulotlar</th>
                      <th className="px-3 py-2 text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {plan.orders.map(({ item: o, duplicate }) => (
                      <tr key={o.key} className={duplicate ? "text-ink-400 line-through" : ""}>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatDate(o.date)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">{o.refs.join(", ")}</td>
                        <td className="px-3 py-1.5">
                          {customerName(o.customer_key)}
                          {o.brand && <span className="text-xs text-ink-500"> · {o.brand}</span>}
                        </td>
                        <td className="px-3 py-1.5">{o.lines.map((l) => `${l.product_name} ×${l.quantity}`).join("; ")}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={run} disabled={running || (!plan.newOrders && !plan.newProducts)}>
              {running ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Tizimga kiritish
            </button>
            <button className="btn-secondary" onClick={() => setPlan(null)} disabled={running}>
              Bekor qilish
            </button>
            <span className="text-xs text-ink-500">Keyin kerak bo'lsa, pastdagi tarixdan butun importni bitta tugma bilan qaytarasiz.</span>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-3 font-display text-sm font-bold text-ink-900">Importlar tarixi</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-ink-500">Hali import qilinmagan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Fayl</th>
                  <th className="py-2 pr-3">Davr</th>
                  <th className="py-2 pr-3">Kiritildi</th>
                  <th className="py-2 pr-3">Holat</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {batches.map((b) => {
                  const st = STATUS[b.status] || STATUS.done;
                  return (
                    <tr key={b.id} className="align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-ink-900">{b.file_name}</div>
                        <div className="text-xs text-ink-500">
                          {formatDateTime(b.created_at)} · {b.created_by} · {b.paid_mode === "paid" ? "hammasi to'langan" : "Excel'dagidek"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{b.date_from ? `${formatDate(b.date_from)} — ${formatDate(b.date_to)}` : "—"}</td>
                      <td className="py-2 pr-3">
                        {b.orders_created} buyurtma ({formatMoney(b.total_amount)}), {b.customers_created} mijoz, {b.products_created} mahsulot
                        {b.error && <div className="text-xs text-rose-700">{b.error}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className="whitespace-nowrap py-2 text-right">
                        {b.status !== "undone" && b.status !== "running" &&
                          (confirmUndo === b.id ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-xs text-ink-600">Hammasi o'chirilsinmi?</span>
                              <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setConfirmUndo(null)}>
                                Yo'q
                              </button>
                              <button className="btn-primary !bg-rose-600 !px-2 !py-1 text-xs" onClick={() => undo(b.id)} disabled={running}>
                                Ha, qaytarish
                              </button>
                            </span>
                          ) : (
                            <button className="btn-ghost !px-2 text-xs" onClick={() => setConfirmUndo(b.id)} disabled={running}>
                              <RotateCcw className="h-3.5 w-3.5" /> Qaytarish
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
