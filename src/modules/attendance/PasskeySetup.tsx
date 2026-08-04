import { useEffect, useState } from "react";
import { Fingerprint, Laptop, Plus, Smartphone, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import type { WebAuthnCredential } from "../../lib/types";
import {
  isPasskeySupported,
  isPlatformAuthenticatorAvailable,
  registerPasskey,
} from "../../services/webauthnService";
import { listMyCredentials, revokeCredential } from "../../services/attendanceService";
import { formatDateTime } from "../../lib/format";

const guessDeviceName = (): string => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android qurilma";
  if (/Macintosh/.test(ua)) return "Mac kompyuter";
  if (/Windows/.test(ua)) return "Windows kompyuter";
  return "Qurilma";
};

export default function PasskeySetup() {
  const { user } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [platformReady, setPlatformReady] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!email) return;
    setLoading(true);
    const rows = await listMyCredentials(email);
    setCredentials(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    setSupported(isPasskeySupported());
    void isPlatformAuthenticatorAvailable().then(setPlatformReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const connect = async () => {
    setError(null);
    setRegistering(true);
    try {
      await registerPasskey(guessDeviceName());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setRegistering(false);
    }
  };

  const revoke = async (credentialId: string) => {
    if (!confirm("Ushbu qurilmani uzishni tasdiqlaysizmi?")) return;
    await revokeCredential(credentialId);
    void load();
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-brand-600" />
        <h2 className="font-display text-base font-bold text-ink-900">
          Face ID / Passkey qurilmalar
        </h2>
      </div>

      {!supported && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu brauzer Passkey'ni qo'llab-quvvatlamaydi. iPhone/Android'da Safari yoki Chrome,
          kompyuterda Chrome/Edge ishlatib ko'ring.
        </div>
      )}
      {supported && !platformReady && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu qurilmada Face ID/Touch ID/Windows Hello topilmadi.
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-ink-500">Yuklanmoqda...</div>
      ) : (
        <div className="space-y-2">
          {credentials.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center text-sm text-ink-500">
              Hali qurilma ulanmagan
            </div>
          )}
          {credentials.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-ink-100 p-3"
            >
              <div className="flex items-center gap-2">
                {/iPhone|Android/.test(c.deviceName || "") ? (
                  <Smartphone className="h-4 w-4 text-ink-400" />
                ) : (
                  <Laptop className="h-4 w-4 text-ink-400" />
                )}
                <div>
                  <div className="text-sm font-semibold text-ink-800">
                    {c.deviceName || "Noma'lum qurilma"}
                  </div>
                  <div className="text-xs text-ink-500">
                    Ulandi: {formatDateTime(c.createdAt)}
                    {c.lastUsedAt ? ` · Oxirgi: ${formatDateTime(c.lastUsedAt)}` : ""}
                  </div>
                </div>
              </div>
              <button
                className="btn-ghost text-rose-600 hover:bg-rose-50"
                onClick={() => revoke(c.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-primary mt-4"
        onClick={connect}
        disabled={registering || !supported}
      >
        <Plus className="h-4 w-4" />
        {registering ? "Ulanmoqda..." : "Face ID / Passkey ulash"}
      </button>
    </div>
  );
}
