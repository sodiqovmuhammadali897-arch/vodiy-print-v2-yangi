import { FormEvent, useState } from "react";
import { TriangleAlert as AlertTriangle, LogIn } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

const errorMessage = (code: string): string => {
  switch (code) {
    case "auth/invalid-email":
      return "Email manzili noto'g'ri kiritilgan.";
    case "auth/user-disabled":
      return "Foydalanuvchi bloklangan.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email yoki parol noto'g'ri.";
    case "auth/too-many-requests":
      return "Juda ko'p urinish. Biroz kuting va qayta urinib ko'ring.";
    case "auth/network-request-failed":
      return "Internet aloqasi bilan bog'liq muammo.";
    default:
      return "Kirishda xatolik yuz berdi. Qayta urinib ko'ring.";
  }
};

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      setError(errorMessage(code));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-ink-900">
              Poligrafiya ERP
            </h1>
            <p className="text-xs text-ink-500">Tizimga kirish</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">
              Parol
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="********"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {submitting ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-500">
          Kirish ma'lumotlari yo'q bo'lsa administrator bilan bog'laning.
        </p>
      </div>
    </div>
  );
}
