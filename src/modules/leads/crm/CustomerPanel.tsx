import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, PhoneIncoming, PhoneOutgoing, RotateCcw, X } from "lucide-react";
import { listWhere } from "../../../lib/firestoreDb";
import { formatMoneyShort } from "../../../lib/format";
import { dealLabel, groupInfo, mergeCalls, phoneForms, secLabel, type ErpCallRow } from "../../../lib/crmBase";
import type { BaseCall, CrmBaseDoc } from "../../../lib/types";

// Mijozlar bazasi → one customer, full (2026-11-26; owner: «bazani polni
// ma'lumotlari bilan, audio qo'ng'iroqlari bilan ko'rsa bo'ladimi»): every
// closed deal with all its amoCRM fields, every call with its recording
// (amoCRM's Mois Zvonki notes + the ERP's own calls), the managers' notes.
// Opens from the right over the base or over a lead card.
type Tab = "deals" | "calls" | "notes";
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function CustomerPanel({ c, onClose, onReopen, busy, names = {} }: { c: CrmBaseDoc; onClose: () => void; onReopen?: () => void; busy?: boolean; names?: Record<string, string> }) {
  const [tab, setTab] = useState<Tab>("calls");
  const [erp, setErp] = useState<ErpCallRow[] | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    Promise.all(phoneForms(c.digits, c.phone).map((p) => listWhere<ErpCallRow>("calls", "phone", p).catch(() => [])))
      .then((lists) => live && setErp(lists.flat().filter((r) => !r.contact)))
      .catch(() => live && setErp([]));
    return () => {
      live = false;
    };
  }, [c.digits, c.phone]);
  const calls = useMemo(() => mergeCalls(c.calls || [], (erp || []).map((r) => ({ ...r, staff_name: r.staff_email ? names[r.staff_email.toLowerCase()] || r.staff_email : "" }))), [c.calls, erp, names]);
  const talk = calls.reduce((t, x) => t + (x.sec || 0), 0);
  const notes = c.notes || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Mijoz kartasi">
      <div className="modal-backdrop absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="drawer-in relative flex h-full w-full max-w-[760px] flex-col bg-ink-50 shadow-2xl lg:rounded-l-3xl">
        <header className="border-b border-ink-100 bg-surface px-5 py-4 lg:rounded-tl-3xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-extrabold text-ink-900">{c.brand ? `«${c.brand}»` : c.name || "Ismsiz"}</h2>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-600">
                {c.brand && c.name && <span>{c.name}</span>}
                <a className="tabular-nums hover:text-brand-700 hover:underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>
                  {c.phone}
                </a>
                {c.region && <span>{c.region}</span>}
                {c.industry && <span>{c.industry}</span>}
              </div>
            </div>
            {onReopen && (
              <button type="button" className="btn-primary shrink-0 py-1.5 text-sm" disabled={busy} onClick={onReopen}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Qayta ishlash
              </button>
            )}
            <button type="button" aria-label="Yopish" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <Stat label="Bitim" value={String(c.deals.length)} />
            <Stat label="Yutilgan" value={String(c.won || 0)} />
            <Stat label="Qo'ng'iroq" value={erp === null ? "…" : String(calls.length)} />
            <Stat label="Gaplashgan" value={talk ? secLabel(talk) : "—"} />
          </div>
          <div className="mt-3 inline-flex rounded-xl border border-ink-200 bg-surface p-1">
            {(
              [
                ["calls", `Qo'ng'iroqlar ${erp === null ? "" : calls.length}`],
                ["deals", `Bitimlar ${c.deals.length}`],
                ["notes", `Izohlar ${notes.length}`],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-900"}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "calls" ? (
            erp === null && !(c.calls || []).length ? (
              <div className="h-24 animate-pulse rounded-xl bg-ink-100/70" />
            ) : !calls.length ? (
              <Empty text="Qo'ng'iroq topilmadi. amoCRM arxivini qayta ko'chirsangiz, eski qo'ng'iroqlar qo'shiladi." />
            ) : (
              <ul className="space-y-2">
                {calls.map((x) => (
                  <CallRow key={x.id} x={x} />
                ))}
              </ul>
            )
          ) : tab === "deals" ? (
            <ul className="space-y-3">
              {c.deals.map((d) => {
                const g = groupInfo(d.group);
                return (
                  <li key={d.key} className="rounded-2xl border border-ink-100 bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.cls}`}>{dealLabel(d)}</span>
                      <span className="text-ink-600">{d.closed_at ? when(d.closed_at).slice(0, 10) : "—"}</span>
                      <span className="font-semibold text-ink-800">{d.manager_name || "—"}</span>
                      {d.price ? <span className="tabular-nums text-ink-600">{formatMoneyShort(d.price)}</span> : null}
                      <span className={`ml-auto rounded px-1.5 text-[10px] font-bold ${d.source === "amo" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>{d.source === "amo" ? `amoCRM #${d.amo_id || ""}` : `ERP ${d.title || ""}`}</span>
                    </div>
                    {d.title && d.source === "amo" && <div className="mt-1 text-xs text-ink-500">{d.title}</div>}
                    {d.comment && <div className="mt-1 text-xs text-ink-600">«{d.comment}»</div>}
                    {(d.fields || []).length > 0 && (
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                        {(d.fields || []).map((f, i) => (
                          <div key={i} className="flex gap-2">
                            <dt className="shrink-0 text-ink-500">{f.label}:</dt>
                            <dd className="min-w-0 break-words font-medium text-ink-800">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {!d.fields && d.product && <div className="mt-1 text-xs text-ink-600">Mahsulot: {d.product}</div>}
                    {(d.tags || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(d.tags || []).map((t) => (
                          <span key={t} className="rounded bg-indigo-50 px-1.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !notes.length ? (
            <Empty text="Izoh yo'q." />
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-2xl border border-ink-100 bg-surface p-3 text-sm">
                  <div className="mb-1 text-xs text-ink-500">
                    {when(n.at)} · <b className="text-ink-700">{n.who || "—"}</b>
                  </div>
                  <p className="whitespace-pre-wrap text-ink-800">{n.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function CallRow({ x }: { x: BaseCall }) {
  const missed = x.sec === 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-ink-100 bg-surface px-3 py-2 text-sm">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${missed ? "bg-rose-50 text-rose-600 dark:bg-rose-900/30" : x.dir === "in" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" : "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200"}`}>
        {x.dir === "in" ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
      </span>
      <span className="min-w-[150px]">
        <span className="block font-semibold text-ink-900">{x.dir === "in" ? "Kiruvchi" : "Chiquvchi"} · {missed ? <span className="text-rose-600">javobsiz</span> : secLabel(x.sec)}</span>
        <span className="block text-xs text-ink-500">
          {when(x.at)} · {x.who || "—"} · {x.src === "amo" ? "amoCRM" : "ERP"}
        </span>
      </span>
      {x.link && !missed ? <audio controls preload="none" src={x.link} className="h-8 w-full sm:ml-auto sm:w-[280px]" /> : <span className="text-xs text-ink-400 sm:ml-auto">{missed ? "" : "yozuv yo'q"}</span>}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-2 py-1.5 dark:bg-ink-800/40">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="font-display text-base font-extrabold text-ink-900" data-no-count>
        {value}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-ink-500">{text}</p>;
}
