import { useEffect, useState } from "react";
import { CheckCircle2, Database, Download, Loader, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { checkForUpdate, clearDeviceCache, storageInfo, type StorageInfo } from "../../lib/appUpdate";
import { clearLocalData } from "../../lib/firebase";

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

// "16-oktabr, 09:57" in Tashkent time (browsers spell uz-UZ months oddly).
const builtAt = (): string => {
  const t = new Date(new Date(__BUILD_TIME__).getTime() + 5 * 3600 * 1000);
  if (Number.isNaN(t.getTime())) return "—";
  const hm = `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]}, ${hm}`;
};

const isAndroid = /Android/i.test(navigator.userAgent);
const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Sozlamalar → Ilova: which version is running, look for a new one, what
// the phone keeps, and the Android app / iPhone home-screen install.
export default function AppPanel() {
  const [update, setUpdate] = useState<"idle" | "checking" | "latest" | "new" | "unknown">("idle");
  const [store, setStore] = useState<StorageInfo | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void storageInfo().then(setStore);
  }, []);

  const check = async () => {
    setUpdate("checking");
    const found = await checkForUpdate();
    setUpdate(found === null ? "unknown" : found ? "new" : "latest");
  };

  const clear = async () => {
    if (!window.confirm("Telefonda saqlangan ma'lumot va ilova fayllari o'chiriladi, keyin ilova qayta yuklanadi. Davom etilsinmi?")) return;
    setClearing(true);
    await clearDeviceCache();
    await clearLocalData();
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-ink-900">Yangilanish</h2>
            <p className="mt-0.5 text-sm text-ink-500">Hozirgi versiya: {builtAt()}</p>
            <p className="mt-2 text-sm text-ink-600">
              Yangi versiya o'zi keladi: ilovaga 10 daqiqadan keyin qaytsangiz o'zi yangilanadi, ishlab turganingizda pastda «Yangilash» chiqadi.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {update === "new" ? (
                <button className="btn-primary" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4" /> Yangilash
                </button>
              ) : (
                <button className="btn-secondary" disabled={update === "checking"} onClick={() => void check()}>
                  {update === "checking" ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Yangilanishni tekshirish
                </button>
              )}
              {update === "latest" && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Eng yangi versiya
                </span>
              )}
              {update === "new" && <span className="text-sm font-medium text-brand-700">Yangi versiya tayyor</span>}
              {update === "unknown" && <span className="text-sm text-ink-500">Tekshirib bo'lmadi — internetni tekshiring</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-ink-900">Telefondagi xotira</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              {store?.usedMb != null ? `Saqlangan: ${store.usedMb < 1 ? "1 MB dan kam" : `${Math.round(store.usedMb)} MB`}` : "Saqlangan hajmni bilib bo'lmadi"}
              {store?.kept === true && " · o'chirmaguningizcha saqlanadi"}
            </p>
            <p className="mt-2 text-sm text-ink-600">
              Bir marta yuklangan ma'lumotlar telefonda qoladi va o'zi yangilanib turadi — internet sekin yoki yo'q paytda ham darhol ko'rinadi. Tizimdan chiqib qayta kirsangiz ham saqlanadi; shu telefonga boshqa xodim kirsa — o'chiriladi.
            </p>
            <button className="btn-ghost mt-3 text-red-600 hover:bg-red-50" disabled={clearing} onClick={() => void clear()}>
              {clearing ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Keshni tozalash
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-ink-900">Telefonga o'rnatish</h2>
            {!isIos && (
              <div className="mt-2">
                <p className="text-sm text-ink-600">Android: Vodiyprint ilovasi (APK). Bir marta o'rnatiladi, keyin o'zi yangilanadi.</p>
                <a href="/app.apk" download="Vodiyprint.apk" className="btn-secondary mt-3">
                  <Download className="h-4 w-4" /> Android ilovani yuklab olish
                </a>
              </div>
            )}
            {!isAndroid && (
              <p className="mt-3 text-sm text-ink-600">
                iPhone: Safari'da printvodiy.uz → «Ulashish» → «Bosh ekranga qo'shish». Ikonka ilovadek ochiladi.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
