import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { CheckCircle2, Loader, RefreshCw, RotateCcw, Save, XCircle } from "lucide-react";
import { db } from "../../lib/firebase";
import { subscribeOne, upsertOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { formatDateTime } from "../../lib/format";

// Keep in sync with DEFAULT_TEXTS in meta-webhook/instagram.js — the
// server falls back to these whenever a field is left empty.
const DEFAULT_TEXTS = {
  greeting:
    "Assalomu alaykum! 😊 Vodiy Print mahsulotlariga qiziqish bildirganingiz uchun rahmat. Ismingiz va telefon raqamingizni qoldirsangiz, menejerlarimiz ish vaqtida siz bilan bog'lanishadi.",
  comment:
    "Assalomu alaykum! 😊 Postimizga izoh qoldirganingiz uchun rahmat. Ismingiz va telefon raqamingizni shu yerga yozib qoldirsangiz, menejerlarimiz ish vaqtida siz bilan bog'lanishadi.",
  nudge: "Iltimos, ismingiz va telefon raqamingizni yozib qoldiring (masalan: Aziz, 90 123 45 67) — menejerimiz siz bilan bog'lanadi.",
  thanks: "Rahmat, {ism}! ✅ Ma'lumotlaringiz qabul qilindi. Menejerlarimiz ish vaqtida {telefon} raqamiga bog'lanishadi.",
};
type TextKey = keyof typeof DEFAULT_TEXTS;

const TEXT_FIELDS: { key: TextKey; label: string; hint: string }[] = [
  { key: "greeting", label: "Direct'ga birinchi yozganda", hint: "Kimdir Direct'ga birinchi marta yozganda yuboriladi." },
  { key: "comment", label: "Post ostida izoh qoldirganda", hint: "Izoh egasiga Direct orqali yuboriladi (bir marta)." },
  { key: "nudge", label: "Raqam yozmasa (eslatma)", hint: "Javobida telefon bo'lmasa, bir marta eslatadi." },
  { key: "thanks", label: "Raqam qoldirganda", hint: "{ism} va {telefon} o'rniga mijozning ismi va raqami qo'yiladi." },
];

type Config = { enabled?: boolean; reply_comments?: boolean; texts?: Partial<Record<TextKey, string>> };

type Status = {
  ok: boolean;
  page: { id: string; name: string } | null;
  instagram: { id: string; username: string; name?: string } | null;
  app: { id: string; name: string } | null;
  scopes: string[];
  missing: string[];
  comments_scope: boolean;
  subscription: { active: boolean; fields: string[] } | null;
  error: string;
};

type Conversation = {
  id: string;
  username?: string;
  name?: string;
  name_profile?: string;
  state: "new" | "asked" | "commented" | "done" | "human";
  via?: "direct" | "comment";
  phone?: string;
  lead_number?: string;
  texts?: string[];
  updated_at?: string;
};

const STATE_LABEL: Record<Conversation["state"], { text: string; cls: string }> = {
  new: { text: "Yangi", cls: "bg-ink-50 text-ink-700" },
  asked: { text: "Raqam kutilmoqda", cls: "bg-amber-50 text-amber-800" },
  commented: { text: "Izohga yozildi", cls: "bg-amber-50 text-amber-800" },
  done: { text: "Lid yaratildi", cls: "bg-emerald-50 text-emerald-700" },
  human: { text: "Menejer yozishmoqda", cls: "bg-sky-50 text-sky-700" },
};

const Check = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-sm">
    {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
    <span className={ok ? "text-ink-700" : "text-ink-900"}>{children}</span>
  </li>
);

// Settings for the Instagram Direct agent (meta-webhook/instagram.js):
// connection check, on/off switches, the reply texts and recent chats.
export default function InstagramPanel() {
  const { user } = useAuth();
  const [config, setConfig] = useState<Config>({});
  const [draft, setDraft] = useState<Record<TextKey, string>>(DEFAULT_TEXTS);
  const [enabled, setEnabled] = useState(true);
  const [replyComments, setReplyComments] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);

  useEffect(
    () =>
      subscribeOne<Config>("instagram_config", "main", (row) => {
        const c: Config = row || {};
        setConfig(c);
        if (!loaded) {
          setEnabled(c.enabled !== false);
          setReplyComments(c.reply_comments !== false);
          setDraft({
            greeting: c.texts?.greeting || DEFAULT_TEXTS.greeting,
            comment: c.texts?.comment || DEFAULT_TEXTS.comment,
            nudge: c.texts?.nudge || DEFAULT_TEXTS.nudge,
            thanks: c.texts?.thanks || DEFAULT_TEXTS.thanks,
          });
          setLoaded(true);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const q = query(collection(db, "ig_conversations"), orderBy("updated_at", "desc"), limit(15));
    return onSnapshot(
      q,
      (snap) => setConvos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversation, "id">) }))),
      () => setConvos([]),
    );
  }, []);

  const check = async (resubscribe: boolean) => {
    setChecking(true);
    setStatusError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/webhooks/instagram/status", {
        method: resubscribe ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server javob bermadi (${res.status})`);
      setStatus(data as Status);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) void check(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const texts: Partial<Record<TextKey, string>> = {};
      for (const f of TEXT_FIELDS) {
        const v = draft[f.key].trim();
        // Storing an unchanged default would pin today's wording forever.
        texts[f.key] = v && v !== DEFAULT_TEXTS[f.key] ? v : "";
      }
      await upsertOne("instagram_config", "main", { enabled, reply_comments: replyComments, texts, updated_at: new Date().toISOString() });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    enabled !== (config.enabled !== false) ||
    replyComments !== (config.reply_comments !== false) ||
    TEXT_FIELDS.some((f) => draft[f.key].trim() !== (config.texts?.[f.key] || DEFAULT_TEXTS[f.key]));

  const subscribed = Boolean(status?.subscription?.active && status.subscription.fields.includes("messages"));

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Instagram Direct agenti</h2>
            <p className="max-w-2xl text-sm text-ink-500">
              Direct'ga yozgan yoki post ostida izoh qoldirganlarga avtomatik javob beradi, ism va raqamini so'raydi. Raqam qoldirilsa — Sotuv
              bo'limida lid ochiladi va Telegram guruhdagi «📸 Instagram Direct» mavzusiga xabar keladi.
            </p>
          </div>
          {status &&
            (status.ok ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Ulangan: @{status.instagram?.username}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">Hali to'liq ulanmagan</span>
            ))}
        </div>

        <div className="rounded-xl bg-ink-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink-800">Ulanish holati</span>
            <button className="btn-ghost !px-2 text-sm" onClick={() => check(true)} disabled={checking}>
              {checking ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tekshirish
            </button>
          </div>
          {statusError && <p className="text-sm text-rose-700">{statusError}</p>}
          {!status && !statusError && <p className="text-sm text-ink-500">Tekshirilmoqda…</p>}
          {status && (
            <ul className="space-y-1.5">
              <Check ok={Boolean(status.page)}>Facebook sahifa: {status.page ? <b>{status.page.name}</b> : "token ishlamayapti"}</Check>
              <Check ok={Boolean(status.instagram)}>
                Instagram biznes akkaunt:{" "}
                {status.instagram ? <b>@{status.instagram.username}</b> : "sahifaga ulanmagan (Facebook sahifa sozlamalari → Instagram → Ulash)"}
              </Check>
              <Check ok={status.missing.length === 0 && status.scopes.length > 0}>
                Token ruxsatlari{status.missing.length ? <>: yetishmaydi — <code className="text-xs">{status.missing.join(", ")}</code></> : ""}
              </Check>
              <Check ok={status.comments_scope}>
                Izohlar ruxsati{status.comments_scope ? "" : <> — <code className="text-xs">instagram_manage_comments</code> yo'q (izohlarga javob ishlamaydi)</>}
              </Check>
              <Check ok={subscribed}>Webhook obunasi (xabarlar{status.subscription?.fields.includes("comments") ? " + izohlar" : ""})</Check>
              {status.error && <li className="text-xs text-rose-700">Meta javobi: {status.error}</li>}
            </ul>
          )}
        </div>

        {status && !status.ok && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-ink-800">
            <div className="mb-1.5 font-semibold">Ulash uchun (bir marta):</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Instagram ilovasida: Sozlamalar → Xabarlar va javoblar → Ulangan vositalar → <b>«Xabarlarga ruxsat berish»</b> ni yoqing.
              </li>
              <li>
                Meta ilovangizda (developers.facebook.com) <b>Messenger</b> → Instagram sozlamalari qo'shilgan bo'lsin, Page tokenni quyidagi ruxsatlar bilan
                qayta oling: <code className="text-xs">instagram_basic, instagram_manage_messages, instagram_manage_comments, pages_manage_metadata</code>.
              </li>
              <li>
                Yangi tokenni GitHub Secrets'dagi <code className="text-xs">META_PAGE_ACCESS_TOKEN</code> ga qo'ying (chatga yubormang) — deploy'dan keyin
                «Tekshirish» ni bosing.
              </li>
            </ol>
          </div>
        )}
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Direct'ga avtomatik javob berish
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            <input type="checkbox" className="h-4 w-4" checked={replyComments} disabled={!enabled} onChange={(e) => setReplyComments(e.target.checked)} />
            Izoh qoldirganlarga Direct'dan yozish
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-800">{f.label}</span>
                {draft[f.key] !== DEFAULT_TEXTS[f.key] && (
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700" onClick={() => setDraft((d) => ({ ...d, [f.key]: DEFAULT_TEXTS[f.key] }))}>
                    <RotateCcw className="h-3 w-3" /> Standart matn
                  </button>
                )}
              </div>
              <textarea
                className="input min-h-[96px] text-sm"
                value={draft[f.key]}
                maxLength={900}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                }}
              />
              <span className="mt-1 block text-xs text-ink-500">{f.hint}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          Agent har bir odamga ko'pi bilan 3 ta xabar yozadi (salom → bitta eslatma → rahmat). Menejer Instagram'dan o'zi javob yozsa, agent o'sha
          suhbatdan chiqadi.
        </p>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Saqlash
          </button>
          {saved && !dirty && <span className="text-sm font-semibold text-emerald-700">Saqlandi</span>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-display text-sm font-bold text-ink-900">So'nggi yozishmalar</h3>
        {convos.length === 0 ? (
          <p className="text-sm text-ink-500">Hali hech kim yozmagan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Kim</th>
                  <th className="py-2 pr-3">Oxirgi xabari</th>
                  <th className="py-2 pr-3">Holat</th>
                  <th className="py-2 pr-3">Raqam</th>
                  <th className="py-2">Vaqt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {convos.map((c) => {
                  const st = STATE_LABEL[c.state] || STATE_LABEL.new;
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-ink-900">{c.username ? `@${c.username}` : c.name_profile || "—"}</div>
                        {c.name && <div className="text-xs text-ink-500">{c.name}</div>}
                      </td>
                      <td className="max-w-xs py-2 pr-3 text-ink-700">
                        <span className="line-clamp-2">{c.texts?.[c.texts.length - 1] || "—"}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                        {c.phone || "—"}
                        {c.lead_number && <div className="text-xs text-ink-500">{c.lead_number}</div>}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-ink-500">{formatDateTime(c.updated_at)}</td>
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
