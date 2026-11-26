import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeadHref } from "./crm/leadLink";
import { ChevronLeft, ChevronRight, PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { listRange } from "../../lib/firestoreDb";
import { talkLabel, talkSeconds, type CallRow } from "../../lib/crmDash";
import { callSummary, dayBounds, filterCalls, shiftDay, tashkentDay, timeOf, unreturned, type CallKind } from "../../lib/callsLog";

// Sotuv bo'limi → «Qo'ng'iroqlar»: one day of calls from Mois Zvonki (the
// server's `calls`) — who took each, how long they talked, the recording,
// the lead it belongs to, and the missed calls nobody returned.
const KINDS: [CallKind, string][] = [
  ["all", "Hammasi"],
  ["in", "Kiruvchi"],
  ["out", "Chiquvchi"],
  ["missed", "O'tkazib yuborilgan"],
];

// `me`: a manager sees only their own calls — made or taken by them, and the
// missed ones on their leads or nobody's (2026-11-26: «faqat o'zini
// ma'lumotlari o'ziga ko'rinsin»); "" = the owner, everyone's.
export default function CallsLog({ sellers, me = "", leads = [] }: { sellers: { email: string; name: string }[]; me?: string; leads?: { id: string; assigned_to_email?: string }[] }) {
  const leadHref = useLeadHref();
  const today = tashkentDay();
  const [day, setDay] = useState(today);
  const [kind, setKind] = useState<CallKind>("all");
  const [staff, setStaff] = useState(me);
  const [allCalls, setCalls] = useState<CallRow[] | null>(null);
  const ownerOf = useMemo(() => new Map(leads.map((l) => [l.id, l.assigned_to_email || ""])), [leads]);
  const calls = useMemo(() => {
    if (!me || !allCalls) return allCalls;
    return allCalls.filter((c) => {
      if (c.staff_email) return c.staff_email === me;
      // a missed call nobody took: theirs if the lead is theirs, or nobody's
      const o = c.lead_id ? (ownerOf.has(c.lead_id) ? ownerOf.get(c.lead_id) || "" : "?") : "";
      return o === me || !o;
    });
  }, [allCalls, me, ownerOf]);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setCalls(null);
    const b = dayBounds(day);
    listRange<CallRow>("calls", "created_at", b.from, b.to)
      .then((rows) => live && setCalls(rows))
      .catch((e) => live && (setError(e instanceof Error ? e.message : "Xato"), setCalls([])));
    // Today keeps coming in: read again every minute.
    const t = day === today ? setInterval(() => listRange<CallRow>("calls", "created_at", b.from, b.to).then((rows) => live && setCalls(rows)).catch(() => undefined), 60000) : null;
    return () => {
      live = false;
      if (t) clearInterval(t);
    };
  }, [day, today]);

  const name = useMemo(() => new Map(sellers.map((s) => [s.email, s.name])), [sellers]);
  const mine = useMemo(() => (calls || []).filter((c) => !staff || me || c.staff_email === staff), [calls, staff, me]);
  const sum = callSummary(mine);
  const list = filterCalls(calls || [], kind, me ? "" : staff);
  const notReturned = new Set(unreturned(calls || []).map((c) => c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 font-display text-2xl font-bold text-ink-900">Qo'ng'iroqlar</h1>
        <div className="inline-flex items-center rounded-xl border border-ink-200 bg-surface">
          <button type="button" aria-label="Oldingi kun" className="px-2 py-1.5 text-ink-500 hover:text-ink-900" onClick={() => setDay(shiftDay(day, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[110px] text-center text-sm font-semibold text-ink-800">{day === today ? "Bugun" : day === shiftDay(today, -1) ? "Kecha" : day}</span>
          <button type="button" aria-label="Keyingi kun" disabled={day >= today} className="px-2 py-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-30" onClick={() => setDay(shiftDay(day, 1))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!me && (
        <select className="input w-auto py-1.5 text-sm" value={staff} onChange={(e) => setStaff(e.target.value)}>
          <option value="">Hamma menejerlar</option>
          {sellers.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name}
            </option>
          ))}
        </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Jami qo'ng'iroq", v: sum.total, hint: `${sum.inbound} kiruvchi · ${sum.outbound} chiquvchi` },
          { label: "Gaplashildi (30 s+)", v: sum.talked, hint: `suhbat ${talkLabel(sum.talk)}` },
          { label: "O'tkazib yuborilgan", v: sum.missed, hint: "kiruvchi, javobsiz", red: sum.missed > 0 },
          { label: "Qayta qilinmagan", v: sum.unreturned, hint: "hali hech kim qaytarmagan", red: sum.unreturned > 0 },
          { label: "O'rtacha suhbat", v: sum.talked ? talkLabel(Math.round(sum.talk / Math.max(1, sum.talked))) : "—", hint: "gaplashilganlar" },
        ].map((t) => (
          <div key={t.label} className={`rounded-2xl border p-4 ${t.red ? "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30" : "border-ink-100 bg-surface"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{t.label}</div>
            <div className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${t.red ? "text-rose-700 dark:text-rose-300" : "text-ink-900"}`}>{t.v}</div>
            <div className="text-xs text-ink-500">{t.hint}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${kind === k ? "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900" : "border border-ink-200 text-ink-700 hover:bg-ink-50"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-ink-100 bg-surface p-2 shadow-sm">
        {calls === null ? (
          <div className="h-32 animate-pulse rounded-2xl bg-ink-100/70" />
        ) : !list.length ? (
          <p className="p-6 text-center text-sm text-ink-500">{error || "Bu kunda qo'ng'iroq yo'q."}</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {list.map((c) => {
              const sec = talkSeconds(c);
              const missed = c.direction === "in" && !c.answered;
              const Icon = missed ? PhoneMissed : c.direction === "in" ? PhoneIncoming : PhoneOutgoing;
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm">
                  <span className="w-12 shrink-0 tabular-nums text-ink-500">{timeOf(c)}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${missed ? "text-rose-600" : c.direction === "in" ? "text-emerald-600" : "text-brand-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-900">{c.client_name || c.phone || "Noma'lum raqam"}</span>
                    <span className="text-xs text-ink-500">
                      {[c.client_name ? c.phone : "", c.staff_email ? name.get(c.staff_email) || c.staff_email : missed ? "hech kim olmadi" : "", sec ? talkLabel(sec) : c.answered ? "" : "javobsiz"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {notReturned.has(c.id) && <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">qayta qo'ng'iroq qiling</span>}
                  {c.lead_id && (
                    <Link to={leadHref(c.lead_id)} className="rounded-lg border border-ink-200 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                      Lid
                    </Link>
                  )}
                  {c.recording_url && sec > 0 && <audio controls preload="none" src={c.recording_url} className="h-8 w-full max-w-[260px] sm:w-[260px]" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
