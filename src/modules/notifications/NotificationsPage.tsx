import { useEffect, useState } from "react";
import { Bell, BellOff, Loader, Send } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { subscribeOne, upsertOne } from "../../lib/firestoreDb";
import {
  disablePush,
  enablePush,
  pushState,
  sendTestPush,
  type PushKind,
  type PushPrefs,
  type PushState,
} from "../../lib/push";

const MINE: { key: PushKind; label: string; hint: string }[] = [
  { key: "amo", label: "amoCRM zadachalar", hint: "09:00 va 18:00 da, zadacha surilganda" },
  { key: "tasks", label: "Vazifalar", hint: "yangi vazifa, izoh, muddati o'tganda" },
  { key: "reminders", label: "⏰ Eslatmalarim", hint: "botda qo'ygan eslatmalar vaqti kelganda" },
  { key: "kpi", label: "KPI", hint: "zakaz va to'lov hisobingizga qo'shilganda" },
];
const ADMIN: { key: PushKind; label: string; hint: string }[] = [
  { key: "admin", label: "Rahbar xabarlari", hint: "surilgan zadacha sababi, kechki hisobot, saytdan ariza" },
];

const STATE_TEXT: Record<PushState, string> = {
  on: "Bu telefonda yoqilgan",
  off: "Bu telefonda o'chiq",
  blocked: "Brauzer sozlamalarida bloklangan",
  unsupported: "Bu brauzer bildirishnomalarni qo'llamaydi",
  "ios-browser": "iPhone: avval saytni bosh ekranga qo'shing",
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-ink-200"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function NotificationsPage() {
  const { user, isAdmin } = useAuth();
  const email = user?.email?.toLowerCase() || "";
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<PushPrefs>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void pushState().then(setState);
  }, []);
  useEffect(() => {
    if (!email) return;
    return subscribeOne<PushPrefs>("push_prefs", email, (row) => setPrefs(row || {}));
  }, [email]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const setPref = (key: PushKind, v: boolean) => {
    setPrefs((p) => ({ ...p, [key]: v }));
    void upsertOne("push_prefs", email, { [key]: v });
  };

  const rows = isAdmin ? [...MINE, ...ADMIN] : MINE;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${state === "on" ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-500"}`}>
            {state === "on" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-ink-900">Telefonga bildirishnoma</h2>
            <p className="mt-0.5 text-sm text-ink-500">{state ? STATE_TEXT[state] : "Tekshirilmoqda…"}</p>
            {state === "blocked" && (
              <p className="mt-2 text-sm text-ink-600">
                Brauzer yoki telefon sozlamalarida printvodiy.uz (Vodiyprint) uchun bildirishnomalarga ruxsat bering, so'ng sahifani yangilang.
              </p>
            )}
            {state === "ios-browser" && (
              <p className="mt-2 text-sm text-ink-600">
                Safari'da «Ulashish» → «Bosh ekranga qo'shish», keyin ilovani bosh ekrandagi Vodiyprint ikonkasidan oching va shu yerda «Yoqish»ni bosing.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {state === "off" && (
                <button className="btn-primary" disabled={busy} onClick={() => run(async () => setState(await enablePush(email)))}>
                  {busy ? <Loader className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Yoqish
                </button>
              )}
              {state === "on" && (
                <>
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await sendTestPush(email);
                        setMsg("Sinov xabari yuborildi — bir necha soniyada telefoningizga keladi.");
                      })
                    }
                  >
                    <Send className="h-4 w-4" /> Sinov xabari
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await disablePush();
                        setState("off");
                      })
                    }
                  >
                    O'chirish
                  </button>
                </>
              )}
            </div>
            {msg && <p className="mt-3 text-sm text-ink-600">{msg}</p>}
          </div>
        </div>
      </div>

      <div className="card divide-y divide-ink-100 px-5">
        <div className="py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Qaysi xabarlar kelsin</div>
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <div className="text-sm font-medium text-ink-900">{r.label}</div>
              <div className="text-xs text-ink-500">{r.hint}</div>
            </div>
            <Toggle on={prefs[r.key] !== false} onChange={(v) => setPref(r.key, v)} />
          </div>
        ))}
      </div>
      <p className="px-1 text-xs text-ink-500">
        Telegram xabarlari ham kelaveradi. Tanlov hamma qurilmalaringiz uchun bir xil; yoqish esa har bir telefonda alohida.
      </p>
    </div>
  );
}
