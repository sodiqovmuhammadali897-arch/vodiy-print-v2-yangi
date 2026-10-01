import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Hand, Megaphone, Settings2, Target, TrendingDown, TrendingUp, Trophy, Wallet } from "lucide-react";
import { getOne, subscribeAll, subscribeOne, updateOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { ADS_DEFAULTS, OPEN_STAGES, cplTone, formatSom, movesFor, type AdsCampaign, type AdsProposal, type AdsSettings, type AdsSummary } from "../../lib/ads";

// Reklama: the Targetolog agent's page (meta-webhook/targetolog.js).
// Numbers come from Meta every 15 minutes; changes go marketolog → admin.

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "● Faol", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  PAUSED: { label: "❚❚ To'xtatilgan", cls: "bg-ink-100 text-ink-600" },
  CAMPAIGN_PAUSED: { label: "❚❚ To'xtatilgan", cls: "bg-ink-100 text-ink-600" },
  IN_PROCESS: { label: "◔ Tekshiruvda", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  PENDING_REVIEW: { label: "◔ Tekshiruvda", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  WITH_ISSUES: { label: "⚠ Muammo", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  DISAPPROVED: { label: "✕ Rad etilgan", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};
const TONE = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  ok: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  none: "bg-ink-100 text-ink-500",
};
const STAGE_LABEL: Record<string, string> = {
  warning: "Ogohlantirish",
  review: "Marketolog ko'rib chiqadi",
  approve: "Admin tasdig'ini kutyapti",
  approved: "Bajarilmoqda",
  executing: "Bajarilmoqda",
  done: "Bajarildi",
  failed: "Bajarilmadi",
  rejected: "Rad etildi",
  kept: "Davom ettirildi",
};
const hm = (iso?: string) => (iso ? new Date(Date.parse(iso) + 5 * 3600e3).toISOString().slice(11, 16) : "—");
const dayHm = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(Date.parse(iso) + 5 * 3600e3).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm ${className}`}>{children}</div>;
}
function Title({ icon, title, hint, right }: { icon: React.ReactNode; title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-600">{icon}</span>
        <div>
          <h3 className="font-display text-[15px] font-bold text-ink-900">{title}</h3>
          {hint && <p className="text-xs text-ink-500">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-ink-50 text-ink-500">{icon}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight text-ink-900">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}
function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 90},${24 - (v / max) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 90 26" className="h-6 w-[90px]" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

export default function AdsPage() {
  const { isAdmin, can, staff, user } = useAuth();
  const marketer = !isAdmin && can("ads", "edit");
  const [summary, setSummary] = useState<AdsSummary | null | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<AdsCampaign[]>([]);
  const [proposals, setProposals] = useState<AdsProposal[]>([]);
  const [logRows, setLogRows] = useState<{ id: string; text: string; by: string; at: string }[]>([]);
  const [settings, setSettings] = useState<AdsSettings>(ADS_DEFAULTS);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeOne<AdsSummary>("ads_state", "summary", (s) => setSummary(s || null)), []);
  useEffect(() => subscribeAll<AdsCampaign>("ads_campaigns", setCampaigns), []);
  useEffect(() => subscribeAll<AdsProposal>("ads_proposals", setProposals, { orderBy: ["created_at", "desc"] }), []);
  useEffect(() => subscribeAll<{ text: string; by: string; at: string }>("ads_log", setLogRows, { orderBy: ["at", "desc"] }), []);
  useEffect(() => {
    void getOne<AdsSettings>("ads_settings", "default").then((s) => s && setSettings({ ...ADS_DEFAULTS, ...s }));
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const open = proposals.filter((p) => OPEN_STAGES.includes(p.stage));
  const recent = proposals.filter((p) => !OPEN_STAGES.includes(p.stage)).slice(0, 4);
  const sorted = useMemo(() => [...campaigns].sort((a, b) => Number(b.active) - Number(a.active) || b.month.spend - a.month.spend), [campaigns]);
  const avg = summary?.avg_cpl ?? null;
  const mult = settings.stop_multiplier || 3;

  const move = async (p: AdsProposal, to: AdsProposal["stage"], action: string) => {
    setBusy(p.id);
    try {
      const at = new Date().toISOString();
      await updateOne("ads_proposals", p.id, { stage: to, updated_at: at, history: [...(p.history || []), { at, by: staff?.full_name || user?.email || "?", action }] });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
          <Target className="h-3.5 w-3.5" /> Targetolog agent
        </div>
        <h1 className="mt-1 font-display text-[28px] font-extrabold leading-tight text-ink-900">Reklama</h1>
        <p className="text-sm text-ink-500">Facebook va Instagram reklamalari · o'zgarishlar marketolog → admin tasdig'i bilan</p>
      </div>
      {summary && (
        <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold lg:self-auto ${summary.ok === false ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
          <span className={`h-2 w-2 rounded-full ${summary.ok === false ? "bg-rose-500" : "bg-emerald-500"}`} />
          {summary.ok === false ? "Meta bilan xato" : `Meta · ${summary.account?.name || ""} · ${hm(summary.last_sync)} da yangilandi`}
        </span>
      )}
    </div>
  );

  if (summary === undefined) return <div className="space-y-5">{header}<div className="h-40 animate-pulse rounded-3xl bg-ink-100/70" /></div>;
  if (summary === null || !summary.month) {
    return (
      <div className="space-y-5">
        {header}
        <Card>
          <div className="font-display text-base font-bold text-ink-900">Meta reklama hisobi hali ulanmagan</div>
          <p className="mt-1 text-sm text-ink-500">
            Admin Meta Business'da reklama hisobini <b>vodiy-erp</b> tizim foydalanuvchisiga to'liq boshqarish huquqi bilan biriktiradi, <b>ads_management</b> ruxsatli tokenni GitHub Secrets ga
            (META_ADS_TOKEN, META_AD_ACCOUNT_ID) qo'yadi. Shundan keyin 15 daqiqa ichida ma'lumotlar shu yerda paydo bo'ladi.
          </p>
          {summary?.error && <p className="mt-2 text-sm text-rose-600">Oxirgi xato: {summary.error}</p>}
        </Card>
        {isAdmin && <SettingsCard settings={settings} onSaved={setSettings} />}
      </div>
    );
  }

  const month = summary.month;
  const prev = summary.prev_month_same_days;
  const growth = prev && prev.results ? ((month.results - prev.results) / prev.results) * 100 : null;
  const usedPct = Math.min(100, (month.spend / Math.max(1, settings.monthly_limit)) * 100);
  const today = summary.today || { spend: 0, results: 0, cpl: null };

  return (
    <div className="space-y-5 pb-6">
      {header}

      {summary.ok === false && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Meta'dan o'qib bo'lmadi: {summary.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="col-span-2 rounded-3xl bg-gradient-to-br from-brand-600 via-blue-600 to-indigo-600 p-5 text-white shadow-lg shadow-blue-600/20">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Oylik byudjet</div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">{Math.round(usedPct)}%</span>
          </div>
          <div className="mt-1 font-display text-4xl font-extrabold tabular-nums">
            {formatSom(month.spend)} <span className="text-base font-semibold text-white/75">so'm</span>
          </div>
          <div className="text-xs text-white/75">{formatSom(settings.monthly_limit)} so'm chegaradan</div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${usedPct}%` }} />
          </div>
          <div className="mt-2 text-xs text-white/80">
            Bugun {formatSom(today.spend)} / {formatSom(settings.daily_limit)} so'm · faol reklamalar kuniga {formatSom(summary.active_daily_budget)} so'm
          </div>
        </div>
        <Kpi
          label="Natijalar"
          value={String(month.results)}
          icon={<Trophy className="h-4 w-4" />}
          hint={
            growth === null ? (
              "lid va Direct yozishmalar"
            ) : (
              <span className={growth >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                {growth >= 0 ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
                {Math.abs(growth).toFixed(0)}% o'tgan oyning shu kunlariga
              </span>
            )
          }
        />
        <Kpi label="Bitta natija narxi" value={month.cpl ? formatSom(month.cpl) : "—"} icon={<Wallet className="h-4 w-4" />} hint={avg ? `30 kunlik o'rtacha ${formatSom(avg)} so'm` : "so'm"} />
        <Kpi label="Bugun" value={formatSom(today.spend)} icon={<Clock3 className="h-4 w-4" />} hint={`so'm · ${today.results} natija · ${summary.active_campaigns ?? 0} ta faol reklama`} />
      </div>

      <Card>
        <Title
          icon={<Hand className="h-4 w-4" />}
          title="Tasdiqingizni kutyapti"
          hint={isAdmin ? "Marketolog ko'rib chiqqan takliflarni tasdiqlaysiz; ogohlantirishda reklamani davom ettirish ham sizning qaroringiz" : marketer ? "Takliflarni ko'rib chiqing — ma'qullari admin tasdig'iga o'tadi" : "Agent takliflari"}
          right={open.length ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{open.length} ta</span> : undefined}
        />
        <div className="space-y-2.5">
          {open.map((p) => {
            const moves = movesFor(p.stage, { admin: isAdmin, marketer });
            const left = p.deadline_at ? Math.max(0, Math.round((Date.parse(p.deadline_at) - now) / 60000)) : null;
            return (
              <div key={p.id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start ${p.stage === "warning" ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30" : "border-ink-100 bg-ink-50/50"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${p.stage === "warning" ? TONE.bad : p.type === "budget" ? TONE.good : TONE.none}`}>{p.type === "pause" ? "To'xtatish" : p.type === "budget" ? "Byudjet" : "Yoqish"}</span>
                    <span className="font-semibold text-ink-900">{p.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{p.reason}</p>
                  <div className="mt-1 text-[11px] text-ink-400">
                    {STAGE_LABEL[p.stage]}
                    {p.stage === "warning" && left !== null ? ` · ${left} daqiqadan keyin o'zi to'xtatiladi` : ""}
                    {(p.history || []).filter((h) => h.by !== "agent").map((h) => ` · ${h.by} ${h.action}`).join("")}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {moves.map((m) => (
                    <button
                      key={m.to}
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => void move(p, m.to, m.action)}
                      className={`rounded-xl px-3.5 py-2 text-sm font-bold disabled:opacity-50 ${m.tone === "ok" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!open.length && <div className="rounded-2xl bg-ink-50/60 p-4 text-sm text-ink-500">Hozircha taklif yo'q. Agent har 15 daqiqada reklamalarni tekshiradi, ertalab hisobot va takliflar yuboradi.</div>}
          {recent.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-1 text-xs text-ink-500">
              <span className="truncate">{p.title}</span>
              <span className={`shrink-0 rounded-lg px-2 py-0.5 font-bold ${p.stage === "done" ? TONE.good : p.stage === "failed" ? TONE.bad : TONE.none}`}>
                {STAGE_LABEL[p.stage]}
                {p.result ? ` — ${p.result}` : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="px-5 pt-5">
          <Title icon={<Megaphone className="h-4 w-4" />} title="Kampaniyalar" hint={`Shu oy: sarf, natija va bitta natija narxi. Rang o'rtacha narxga nisbatan (${mult} baravardan oshsa qizil).`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-2.5 text-left font-semibold">Kampaniya</th>
                <th className="px-3 py-2.5 text-left font-semibold">Holat</th>
                <th className="px-3 py-2.5 text-right font-semibold">Kunlik byudjet</th>
                <th className="px-3 py-2.5 text-right font-semibold">Sarflandi</th>
                <th className="px-3 py-2.5 text-right font-semibold">Natija</th>
                <th className="px-3 py-2.5 text-right font-semibold">Narxi</th>
                <th className="px-3 py-2.5 text-right font-semibold">3 kun</th>
                <th className="px-5 py-2.5 text-left font-semibold">7 kun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sorted.map((c) => {
                const st = STATUS[c.effective_status] || STATUS[c.status] || { label: c.effective_status, cls: TONE.none };
                const tone = cplTone(c.month.cpl, avg, mult);
                const tone3 = c.d3.spend > 0 && !c.d3.results ? "bad" : cplTone(c.d3.cpl, avg, mult);
                return (
                  <tr key={c.id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-ink-900">{c.name}</div>
                      <div className="text-[11px] text-ink-400">{c.objective.replace("OUTCOME_", "").toLowerCase()}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{c.daily_budget ? formatSom(c.daily_budget) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatSom(c.month.spend)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-ink-900">{c.month.results}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${TONE[tone]}`}>{c.month.cpl ? formatSom(c.month.cpl) : "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${TONE[tone3]}`}>
                        {c.d3.spend ? `${formatSom(c.d3.spend)} · ${c.d3.results}` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Spark values={c.trend7} color={tone === "bad" ? "#e11d48" : tone === "good" ? "#059669" : "#2563eb"} />
                    </td>
                  </tr>
                );
              })}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink-400">
                    Reklama hisobida kampaniya yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? "xl:grid-cols-[1.3fr_1fr]" : ""}`}>
        <Card>
          <Title icon={<Clock3 className="h-4 w-4" />} title="Agent jurnali" hint="Har bir taklif, tasdiq va o'zgarish" />
          <div className="space-y-2.5">
            {logRows.slice(0, 15).map((l) => (
              <div key={l.id} className="flex gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs font-semibold tabular-nums text-ink-400">{dayHm(l.at)}</span>
                <span className="text-ink-700">{l.text}</span>
              </div>
            ))}
            {!logRows.length && <div className="text-sm text-ink-400">Hali yozuv yo'q</div>}
          </div>
        </Card>
        {isAdmin && <SettingsCard settings={settings} onSaved={setSettings} />}
      </div>
    </div>
  );
}

function SettingsCard({ settings, onSaved }: { settings: AdsSettings; onSaved: (s: AdsSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const field = (key: keyof AdsSettings, label: string, hint: string) => (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      <input
        type="number"
        min={0}
        className="input mt-1 tabular-nums"
        value={draft[key]}
        onChange={(e) => {
          setSaved(false);
          setDraft((d) => ({ ...d, [key]: Number(e.target.value) }));
        }}
      />
      <span className="mt-0.5 block text-[11px] text-ink-400">{hint}</span>
    </label>
  );
  const save = async () => {
    setSaving(true);
    try {
      await upsertOne("ads_settings", "default", { ...draft });
      onSaved(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <Title icon={<Settings2 className="h-4 w-4" />} title="Chegaralar (faqat admin)" hint="Agent bu chegaradan oshadigan o'zgarishni bajarmaydi" />
      <div className="grid grid-cols-2 gap-3">
        {field("daily_limit", "Kunlik chegara, so'm", "faol reklamalar jami")}
        {field("monthly_limit", "Oylik chegara, so'm", "oy oxirigacha bashorat bilan")}
        {field("stop_multiplier", "To'xtatish, × o'rtacha", "lid narxi shuncha marta oshsa")}
        {field("grace_minutes", "Kutish, daqiqa", "ogohlantirishdan keyin")}
        {field("rate", "Kurs, so'm / $", "hisob dollarda bo'lsa")}
        {field("report_hour", "Hisobot soati", "Toshkent vaqti")}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-semibold text-emerald-600">Saqlandi</span>}
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          Saqlash
        </button>
      </div>
    </Card>
  );
}
