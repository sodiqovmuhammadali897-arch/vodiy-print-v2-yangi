import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Lock, Trash2 } from "lucide-react";
import { updateOne, upsertOne } from "../../../lib/firestoreDb";
import { BUILTIN_MANUAL_KEYS, CRM_COLUMNS, CRM_TASK_TYPES, DEFAULT_STAGES, DEFAULT_TASK_TYPES, MANUAL_COLUMNS, ORDER_STAGE_KEYS } from "../../../lib/crm";
import { CONTACT_TYPES, DEFAULT_CONTACT_TYPES } from "../../../lib/contacts";
import { DEFAULT_SECTIONS, newKey, sectionLabel, type SectionKey, type StageSetting, type TypeSetting } from "../../../lib/crmSettings";
import type { CrmData } from "./useCrm";
import { useContacts } from "./useContacts";

// Sotuv bo'limi → Sozlamalar (admins; 2026-11-26): the stages — order,
// names, colours, new ones; the menu's section names; the task types; the
// contact types. «Yangi» stays first (new leads land there); the three after
// an order follow the order's status, so only their names and colours change.
// Built-in stages and types can be renamed, not removed (the server uses them).
const COLORS = ["#94a3b8", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb7185", "#f59e0b", "#10b981", "#16a34a", "#0ea5e9", "#eab308", "#64748b"];
const SECTION_KEYS = Object.keys(DEFAULT_SECTIONS) as SectionKey[];

export default function CrmSettings({ crm }: { crm: CrmData }) {
  const { contacts } = useContacts();
  const [stages, setStages] = useState<StageSetting[]>(() => CRM_COLUMNS.map((c) => ({ key: c.key, label: c.label, color: c.color })));
  const [sections, setSections] = useState<Record<SectionKey, string>>(() => Object.fromEntries(SECTION_KEYS.map((k) => [k, sectionLabel(k)])) as Record<SectionKey, string>);
  const [taskTypes, setTaskTypes] = useState<TypeSetting[]>(() => CRM_TASK_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon })));
  const [contactTypes, setContactTypes] = useState<TypeSetting[]>(() => CONTACT_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon })));
  const [moves, setMoves] = useState<Record<string, string>>({}); // removed stage → where its leads go
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const leadsIn = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of crm.leads || []) if (l.status !== "lost" && !l.converted_order_id) m.set(l.status, (m.get(l.status) || 0) + 1);
    return m;
  }, [crm.leads]);
  const manual = stages.filter((s) => !ORDER_STAGE_KEYS.includes(s.key));
  const orderStages = stages.filter((s) => ORDER_STAGE_KEYS.includes(s.key));
  const setStage = (key: string, patch: Partial<StageSetting>) => setStages((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const moveStage = (key: string, dir: -1 | 1) =>
    setStages((list) => {
      const m = list.filter((s) => !ORDER_STAGE_KEYS.includes(s.key));
      const i = m.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i < 1 || j < 1 || j >= m.length) return list; // «Yangi» stays first
      [m[i], m[j]] = [m[j], m[i]];
      return [...m, ...list.filter((s) => ORDER_STAGE_KEYS.includes(s.key))];
    });
  const removeStage = (key: string) => {
    const n = leadsIn.get(key) || 0;
    setStages((list) => list.filter((s) => s.key !== key));
    if (n) setMoves((m) => ({ ...m, [key]: "accepted" }));
  };
  const addStage = () => setStages((list) => [...list.filter((s) => !ORDER_STAGE_KEYS.includes(s.key)), { key: newKey("st"), label: "Yangi bosqich", color: COLORS[list.length % COLORS.length] }, ...list.filter((s) => ORDER_STAGE_KEYS.includes(s.key))]);

  const save = async () => {
    if (stages.some((s) => !s.label.trim()) || taskTypes.some((t) => !t.label.trim()) || contactTypes.some((t) => !t.label.trim())) return setMsg("Bo'sh nom qolmasin.");
    setBusy(true);
    setMsg(null);
    try {
      // Leads of removed stages go where the owner chose.
      let moved = 0;
      for (const [from, to] of Object.entries(moves)) {
        for (const l of (crm.leads || []).filter((x) => x.status === from && !x.converted_order_id)) {
          await updateOne("leads", l.id, { status: to, updated_at: new Date().toISOString() });
          moved++;
        }
      }
      await upsertOne("crm_settings", "main", {
        stages: stages.map((s) => ({ key: s.key, label: s.label.trim(), color: s.color })),
        sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, (sections[k] || "").trim() || DEFAULT_SECTIONS[k]])),
        task_types: taskTypes.map((t) => ({ key: t.key, label: t.label.trim(), icon: t.icon.trim() || "•" })),
        contact_types: contactTypes.map((t) => ({ key: t.key, label: t.label.trim(), icon: t.icon.trim() || "📇" })),
      });
      setMoves({});
      setMsg(`Saqlandi — hamma menejerlarda darhol ko'rinadi.${moved ? ` ${moved} ta lid yangi bosqichga o'tkazildi.` : ""}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    }
    setBusy(false);
  };
  const reset = () => {
    if (!window.confirm("Hamma nomlar va tartib asl holiga qaytsinmi? (Qo'shilgan bosqich va turlar o'chadi — ularda lid bo'lsa, avval o'tkazing.)")) return;
    // Added stages with leads in them: their leads go to «Qabul qilindi».
    for (const s of manual) if (!BUILTIN_MANUAL_KEYS.includes(s.key) && leadsIn.get(s.key)) setMoves((m) => ({ ...m, [s.key]: "accepted" }));
    setStages(DEFAULT_STAGES.map((c) => ({ key: c.key, label: c.label, color: c.color })));
    setSections({ ...DEFAULT_SECTIONS });
    setTaskTypes(DEFAULT_TASK_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon })));
    setContactTypes(DEFAULT_CONTACT_TYPES.map((t) => ({ key: t.key, label: t.label, icon: t.icon })));
  };

  if (!crm.isAdmin) return <div className="card p-8 text-center text-sm text-ink-500">Sozlamalarni faqat rahbar o'zgartiradi.</div>;
  const stageRow = (s: StageSetting, i: number, locked: "first" | "order" | null) => (
    <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2 dark:bg-ink-800/20">
      {locked ? (
        <Lock className="h-4 w-4 text-amber-500" />
      ) : (
        <span className="flex flex-col">
          <button type="button" aria-label="Yuqoriga" disabled={i <= 1} onClick={() => moveStage(s.key, -1)} className="text-ink-400 hover:text-ink-900 disabled:opacity-20">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Pastga" disabled={i >= manual.length - 1} onClick={() => moveStage(s.key, 1)} className="text-ink-400 hover:text-ink-900 disabled:opacity-20">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
      <input type="color" aria-label="Rang" value={s.color} onChange={(e) => setStage(s.key, { color: e.target.value })} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
      <input className="input w-56 py-1.5" value={s.label} onChange={(e) => setStage(s.key, { label: e.target.value })} />
      {locked === "first" && <span className="text-[11px] text-amber-600 dark:text-amber-300">birinchi turadi — yangi lidlar shu yerga tushadi</span>}
      {locked === "order" && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500">buyurtma holatidan</span>}
      {!BUILTIN_MANUAL_KEYS.includes(s.key) && !ORDER_STAGE_KEYS.includes(s.key) && !MANUAL_COLUMNS.includes(s.key) && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">yangi</span>}
      <span className="ml-auto text-xs text-ink-500">{leadsIn.get(s.key) || 0} lid</span>
      {!locked && !BUILTIN_MANUAL_KEYS.includes(s.key) && (
        <button type="button" aria-label="O'chirish" onClick={() => removeStage(s.key)} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Sotuv bo'limi sozlamalari</h1>
          <p className="text-sm text-ink-500">Faqat rahbar ko'radi. Saqlangandan keyin hamma menejerlarda darhol ko'rinadi.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={reset}>
            Asl holiga
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>
            Saqlash
          </button>
        </div>
      </div>
      {msg && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{msg}</div>}

      <Card title="Bosqichlar (etaplar)" hint="Strelkalar bilan tartibini o'zgartiring, nomi va rangini yozing. Lidlar doskasi va voronka shu tartibda chiqadi.">
        <div className="space-y-2">
          {manual.map((s, i) => stageRow(s, i, i === 0 ? "first" : null))}
          <button type="button" onClick={addStage} className="w-full rounded-xl border border-dashed border-brand-300 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300">
            + Bosqich qo'shish
          </button>
          {Object.entries(moves).map(([from, to]) => (
            <div key={from} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              O'chirilgan bosqichdagi {leadsIn.get(from) || 0} ta lid qayerga o'tsin:
              <select className="input w-auto py-1" value={to} onChange={(e) => setMoves((m) => ({ ...m, [from]: e.target.value }))}>
                {manual.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="pt-2 text-xs text-ink-500">Buyurtmaga aylangandan keyingi bosqichlar — buyurtma holatidan o'zi o'tadi, faqat nomi va rangi o'zgaradi:</p>
          {orderStages.map((s, i) => stageRow(s, i, "order"))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Bo'limlar nomi" hint="Chap menyudagi nomlar.">
          <div className="space-y-2">
            {SECTION_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-ink-400">{DEFAULT_SECTIONS[k]}</span>
                <input className="input py-1.5" value={sections[k]} onChange={(e) => setSections((x) => ({ ...x, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
        </Card>
        <TypesCard title="Zadacha turlari" hint="Zadacha qo'yishda tanlanadi. Asosiylari nomlanadi, o'chirilmaydi." list={taskTypes} setList={setTaskTypes} builtIn={DEFAULT_TASK_TYPES.map((t) => t.key)} prefix="tt" addLabel="+ Tur qo'shish" />
        <TypesCard
          title="Kontakt turlari"
          hint="Kontaktlar bo'limidagi turlar."
          list={contactTypes}
          setList={setContactTypes}
          builtIn={DEFAULT_CONTACT_TYPES.map((t) => t.key)}
          prefix="ct"
          addLabel="+ Tur qo'shish"
          count={(k) => (contacts || []).filter((c) => c.type === k).length}
        />
      </div>
    </div>
  );
}

function TypesCard({ title, hint, list, setList, builtIn, prefix, addLabel, count }: { title: string; hint: string; list: TypeSetting[]; setList: (f: (l: TypeSetting[]) => TypeSetting[]) => void; builtIn: string[]; prefix: string; addLabel: string; count?: (k: string) => number }) {
  return (
    <Card title={title} hint={hint}>
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <input aria-label="Belgi" className="input w-12 px-1 py-1.5 text-center" value={t.icon} onChange={(e) => setList((l) => l.map((x) => (x.key === t.key ? { ...x, icon: e.target.value } : x)))} />
            <input className="input min-w-0 flex-1 py-1.5" value={t.label} onChange={(e) => setList((l) => l.map((x) => (x.key === t.key ? { ...x, label: e.target.value } : x)))} />
            {count && <span className="w-6 text-right text-xs text-ink-400">{count(t.key)}</span>}
            {builtIn.includes(t.key) ? (
              <span className="w-7" />
            ) : (
              <button
                type="button"
                aria-label="O'chirish"
                className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                onClick={() => {
                  if (count && count(t.key) && !window.confirm(`Bu turda ${count(t.key)} ta yozuv bor — ular «Boshqa» bo'lib ko'rinadi. O'chirilsinmi?`)) return;
                  setList((l) => l.filter((x) => x.key !== t.key));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setList((l) => [...l, { key: newKey(prefix), label: "Yangi tur", icon: "•" }])} className="w-full rounded-xl border border-dashed border-brand-300 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300">
          {addLabel}
        </button>
      </div>
    </Card>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-surface p-4">
      <h3 className="font-display text-sm font-extrabold text-ink-900">{title}</h3>
      <p className="mb-3 text-xs text-ink-500">{hint}</p>
      {children}
    </section>
  );
}
