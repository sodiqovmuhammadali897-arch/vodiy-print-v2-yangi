import { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader, MessagesSquare } from "lucide-react";
import { subscribeOne } from "../../lib/firestoreDb";
import { useAuth } from "../../lib/AuthContext";
import { formatDate } from "../../lib/format";

type TelegramConfig = {
  group_chat_id?: number;
  group_title?: string;
  topics?: Record<string, number>;
  linked_at?: string;
};

const TOPIC_LABELS: Record<string, string> = {
  bot: "🧮 Hisobchi",
  it: "🤖 IT",
  sales: "💼 Sotuv",
  fin: "💰 Moliya",
  prod: "🏭 Ishlab chiqarish",
  wh: "📦 Ombor / Ta'minot",
  hr: "🧑‍💼 HR / Davomat",
  ig: "📸 Instagram Direct",
};

// Links the Telegram work group (with Topics) that the agents post into.
// The one-time code is what makes linking safe: only an admin signed in
// here can get one, so adding the bot to any other group does nothing.
export default function TelegramGroupPanel() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [bot, setBot] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeOne<TelegramConfig>("telegram_config", "main", (row) => setConfig(row || {})), []);

  const getCode = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/webhooks/tg-group/code", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.command) throw new Error(data.error || "Kod olinmadi");
      setCommand(data.command);
      setBot(data.bot || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const linked = Boolean(config?.group_chat_id);

  return (
    <div className="card space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Telegram ish guruhi</h2>
          <p className="text-sm text-ink-500">Har bir agent guruhdagi o'z mavzusiga (Topic) yozadi — xabarlar aralashib ketmaydi.</p>
        </div>
        {linked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Ulangan: {config?.group_title || "guruh"}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">Ulanmagan — hozir hisobotlar kanalga ketyapti</span>
        )}
      </div>

      {linked && (
        <div className="rounded-xl bg-ink-50 p-4 text-sm">
          <div className="mb-2 font-semibold text-ink-800">Mavzular</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(TOPIC_LABELS).map((k) => (
              <span key={k} className={`rounded-full px-3 py-1 text-xs font-semibold ${config?.topics?.[k] ? "bg-white text-ink-800 ring-1 ring-ink-100" : "bg-rose-50 text-rose-700"}`}>
                {TOPIC_LABELS[k]}
                {!config?.topics?.[k] && " — ochilmagan"}
              </span>
            ))}
          </div>
          {config?.linked_at && <p className="mt-2 text-xs text-ink-500">Ulangan sana: {formatDate(config.linked_at)}</p>}
        </div>
      )}

      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-700">
        <li>Telegram'da guruh oching va guruh sozlamalarida <b>«Mavzular» (Topics)</b> ni yoqing.</li>
        <li>
          Botni{bot ? <> (<b>@{bot}</b>)</> : ""} guruhga qo'shing va <b>admin</b> qiling — <b>«Mavzularni boshqarish»</b> huquqi bilan.
        </li>
        <li>Pastdagi tugma bilan kod oling va uni guruhga yozing. Bot mavzularni o'zi ochadi.</li>
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={getCode} disabled={busy}>
          {busy ? <Loader className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {linked ? "Qayta ulash kodini olish" : "Ulash kodini olish"}
        </button>
        {command && (
          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
            <MessagesSquare className="h-4 w-4 text-brand-700" />
            <code className="select-all font-mono text-base font-bold text-ink-900">{command}</code>
            <button className="btn-ghost !px-2" onClick={copy} aria-label="Nusxalash">
              <Copy className="h-4 w-4" />
            </button>
            {copied && <span className="text-xs font-semibold text-emerald-700">Nusxalandi</span>}
          </div>
        )}
      </div>
      {command && <p className="text-xs text-ink-500">Kod 30 daqiqa amal qiladi va bir marta ishlatiladi. Shu matnni guruhga (istalgan mavzuga) yuboring.</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
