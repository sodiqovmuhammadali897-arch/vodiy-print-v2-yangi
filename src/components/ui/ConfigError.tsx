import { TriangleAlert as AlertTriangle } from "lucide-react";
import { missingFirebaseKeys } from "../../lib/firebase";

export default function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold text-ink-900">
              Konfiguratsiya xatosi
            </h1>
            <p className="mt-1 text-sm leading-6 text-ink-600">
              Ilovani ishga tushirish uchun Firebase ulanish sozlamalari
              topilmadi. Quyidagi environment variable'lar yetishmayapti:
            </p>

            <ul className="mt-4 space-y-2">
              {missingFirebaseKeys.map((k: string) => (
                <li
                  key={k}
                  className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-800"
                >
                  {k}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm leading-6 text-ink-700">
              <p className="font-semibold text-ink-900">Qanday hal qilish kerak</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-600">
                <li>
                  Lokal muhitda: loyiha ildizidagi <code>.env</code> faylga
                  qiymatlarni qo'shing (<code>.env.example</code>'dan nusxa oling).
                </li>
                <li>
                  Vercel'da: Project Settings &rarr; Environment Variables
                  bo'limiga barcha <code>VITE_FIREBASE_*</code> qiymatlarini
                  qo'shing va qayta deploy qiling.
                </li>
              </ol>
            </div>

            <p className="mt-4 text-xs text-ink-500">
              Qiymatlar Firebase Console &rarr; Project Settings &rarr; General
              &rarr; Your apps bo'limidan olinadi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
