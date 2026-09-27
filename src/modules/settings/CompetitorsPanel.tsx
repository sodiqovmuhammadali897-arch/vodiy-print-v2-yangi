import { useEffect, useState } from "react";
import { ExternalLink, Loader, Pencil, Plus, Radar, Trash2 } from "lucide-react";
import { deleteOne, insertOne, subscribeAll, updateOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { formatDateTime } from "../../lib/format";
import type { Competitor, CompetitorResearch } from "../../lib/types";

type Draft = Omit<Competitor, "id" | "created_at">;
const empty = (): Draft => ({ name: "", city: "", telegram: "", website: "", instagram: "", maps_url: "", note: "", active: true });

const FIELDS: { key: keyof Draft; label: string; placeholder: string }[] = [
  { key: "name", label: "Nomi *", placeholder: "Kans Print" },
  { key: "city", label: "Shahar", placeholder: "Farg'ona" },
  { key: "telegram", label: "Telegram kanal", placeholder: "t.me/kansprint yoki @kansprint" },
  { key: "website", label: "Sayt", placeholder: "kansprint.uz" },
  { key: "instagram", label: "Instagram", placeholder: "instagram.com/kansprint" },
  { key: "maps_url", label: "Google Xarita havolasi", placeholder: "maps.app.goo.gl/…" },
];

const href = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^@/, "t.me/")}`);

// Sozlamalar → Raqobatchilar: who the Marketolog agent watches, and what it
// found last time (meta-webhook/marketing.js).
export default function CompetitorsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Competitor[]>([]);
  const [research, setResearch] = useState<Record<string, CompetitorResearch>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeAll<Competitor>("competitors", setRows, { orderBy: ["name", "asc"] }), []);
  useEffect(
    () =>
      subscribeAll<CompetitorResearch>("competitor_research", (list) => setResearch(Object.fromEntries(list.map((r) => [r.id, r])))),
    [],
  );

  const save = async () => {
    if (!draft || !draft.name.trim()) return setError("Nomini kiriting");
    setSaving(true);
    setError(null);
    try {
      const data = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as Draft;
      if (editId) await updateOne("competitors", editId, data);
      else await insertOne("competitors", data);
      setDraft(null);
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  };

  const run = async (id: string | null) => {
    setRunning(id || "all");
    setError(null);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/webhooks/marketing/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(id ? { id } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server javob bermadi (${res.status})`);
      setMessage(`⏳ ${data.count} ta raqobatchi tahlil qilinmoqda. Har biriga 1–2 daqiqa ketadi — natija shu sahifada va Telegram'dagi «📣 Marketing» mavzusida chiqadi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setRunning(null);
    }
  };

  const active = rows.filter((r) => r.active !== false);

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Raqobatchilar</h2>
            <p className="max-w-3xl text-sm text-ink-500">
              Marketolog agent har dushanba shu ro'yxatdagilarning Telegram kanali, sayti va internetdagi ma'lumotlarini ko'rib chiqadi: narxlar, aksiyalar,
              sharhlar, nima o'zgargani. Lid «Raqobatchini tanladi» bilan yo'qotilganda menejer shu ro'yxatdan tanlaydi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => run(null)} disabled={!!running || active.length === 0}>
              {running === "all" ? <Loader className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />} Hammasini hozir tahlil qilish
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setDraft(empty());
                setEditId(null);
              }}
            >
              <Plus className="h-4 w-4" /> Raqobatchi qo'shish
            </button>
          </div>
        </div>
        {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {draft && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">{f.label}</span>
                  <input
                    className="input"
                    placeholder={f.placeholder}
                    value={String(draft[f.key] ?? "")}
                    onChange={(e) => setDraft((d) => (d ? { ...d, [f.key]: e.target.value } : d))}
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="label">Izoh (agent uchun: nimasi bilan raqobatchi)</span>
                <input className="input" placeholder="Paket va vizitkada arzon, tez tayyorlaydi" value={draft.note} onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))} />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <input type="checkbox" className="h-4 w-4" checked={draft.active} onChange={(e) => setDraft((d) => (d ? { ...d, active: e.target.checked } : d))} />
                Kuzatilsin
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
              <button className="btn-secondary" onClick={() => setDraft(null)}>
                Bekor qilish
              </button>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 && !draft && <div className="card p-5 text-sm text-ink-500">Hali raqobatchi qo'shilmagan.</div>}

      {rows.map((c) => {
        const r = research[c.id];
        const s = r?.summary || {};
        const busy = Boolean(r?.running_since && Date.now() - Date.parse(r.running_since) < 15 * 60 * 1000);
        const links = [c.telegram, c.website, c.instagram, c.maps_url].filter(Boolean);
        return (
          <div key={c.id} className={`card space-y-3 p-5 ${c.active === false ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink-900">
                  {c.name}
                  {c.city && <span className="ml-2 text-sm font-medium text-ink-500">{c.city}</span>}
                  {c.active === false && <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">kuzatilmaydi</span>}
                </h3>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {links.map((l) => (
                    <a key={l} href={href(l)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700">
                      {l.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost !px-2 text-xs" onClick={() => run(c.id)} disabled={!!running || busy || c.active === false}>
                  {running === c.id || busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />} {busy ? "Tahlil qilinmoqda…" : "Tahlil"}
                </button>
                <button
                  className="btn-ghost !px-2"
                  aria-label="Tahrirlash"
                  onClick={() => {
                    setEditId(c.id);
                    setDraft({ name: c.name, city: c.city || "", telegram: c.telegram || "", website: c.website || "", instagram: c.instagram || "", maps_url: c.maps_url || "", note: c.note || "", active: c.active !== false });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {confirmDel === c.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-ink-600">O'chirilsinmi?</span>
                    <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setConfirmDel(null)}>
                      Yo'q
                    </button>
                    <button
                      className="btn-primary !bg-rose-600 !px-2 !py-1 text-xs"
                      onClick={() => {
                        setConfirmDel(null);
                        void deleteOne("competitors", c.id);
                      }}
                    >
                      Ha
                    </button>
                  </span>
                ) : (
                  <button className="btn-ghost !px-2 text-rose-600" aria-label="O'chirish" onClick={() => setConfirmDel(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {r?.researched_at ? (
              <div className="space-y-2 text-sm text-ink-700">
                <div className="text-xs text-ink-500">
                  Oxirgi tahlil: {formatDateTime(r.researched_at)}
                  {r.telegram_subscribers && ` · Telegram: ${r.telegram_subscribers} obunachi`}
                  {r.error && <span className="text-rose-700"> · oxirgi urinishda xato: {r.error}</span>}
                </div>
                {s.qisqacha && <p>{s.qisqacha}</p>}
                {s.ozgarishlar && (
                  <p>
                    <b>Nima o'zgardi:</b> {s.ozgarishlar}
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Narxlar", s.narxlar],
                    ["Aksiyalar", s.aksiyalar],
                    ["Kuchli tomoni", s.kuchli],
                    ["Zaif tomoni", s.zaif],
                  ].map(([label, list]) =>
                    Array.isArray(list) && list.length ? (
                      <div key={String(label)}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                          {list.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </div>
                {s.sharhlar && (
                  <p>
                    <b>Sharhlar:</b> {s.sharhlar}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {r.ad_library && (
                    <a href={r.ad_library} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-700">
                      Faol reklamalari (Meta) <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {(r.sources || []).slice(0, 6).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="text-ink-500 underline">
                      {u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-500">Hali tahlil qilinmagan — «Tahlil» tugmasini bosing yoki dushanbani kuting.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
