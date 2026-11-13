import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Upload } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import {
  FON_PRESETS,
  GLASS_MAX,
  GLASS_MIN,
  fonCss,
  loadFon,
  saveFon,
  shrinkImage,
  type FonState,
} from "../../lib/salesFon";

// Puts the person's chosen picture behind Sotuv bo'limi: on the layout's
// <main> (so it fills the whole content area and stays put while the page
// scrolls), with the «glass» look (index.css .fon-glass) while it is there.
export function useSalesFon() {
  const { user } = useAuth();
  const email = (user?.email || "").toLowerCase();
  const [fon, setFonState] = useState<FonState>(() => loadFon(email));
  useEffect(() => setFonState(loadFon(email)), [email]);

  const css = fonCss(fon);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main.vt-page");
    if (!main || !css) return;
    main.classList.add("dark", "fon-glass");
    main.style.backgroundImage = css;
    main.style.setProperty("--glass-a", String(fon.glass));
    return () => {
      main.classList.remove("dark", "fon-glass");
      main.style.backgroundImage = "";
      main.style.removeProperty("--glass-a");
    };
  }, [css, fon.glass]);

  const setFon = (s: FonState) => {
    setFonState(s);
    return saveFon(email, s);
  };
  return { fon, setFon, on: Boolean(css) };
}

// «🖼 Fon» — the picker: ready pictures, none, one's own photo, and how
// see-through the cards are.
export function FonButton({
  fon,
  setFon,
}: {
  fon: FonState;
  setFon: (s: FonState) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) =>
      box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg("Yuklanmoqda…");
    try {
      const custom = await shrinkImage(f);
      setMsg(
        setFon({ ...fon, key: "custom", custom })
          ? null
          : "Rasm juda katta — boshqasini tanlang",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bo'lmadi");
    }
  };

  const Thumb = ({
    k,
    label,
    bg,
  }: {
    k: string;
    label: string;
    bg: string;
  }) => (
    <button
      type="button"
      onClick={() => setFon({ ...fon, key: k })}
      aria-pressed={fon.key === k}
      className={`relative h-14 overflow-hidden rounded-xl border-2 bg-cover bg-center text-left transition ${fon.key === k ? "border-brand-500 ring-2 ring-brand-300/50" : "border-transparent hover:border-ink-300"}`}
      style={{ backgroundImage: bg }}
    >
      <span className="absolute bottom-1 left-1.5 text-[10.5px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.7)]">
        {label}
      </span>
      {fon.key === k && (
        <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-brand-600 p-0.5 text-white" />
      )}
    </button>
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-secondary py-2"
        aria-expanded={open}
      >
        <ImageIcon className="h-4 w-4" /> Fon
      </button>
      {open && (
        <div className="fon-solid absolute right-0 top-full z-40 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-ink-200 bg-surface p-4 shadow-pop">
          <h3 className="font-display text-sm font-extrabold text-ink-900">
            Fon tanlang
          </h3>
          <p className="mb-3 text-xs text-ink-500">
            Faqat sizda va shu brauzerda ko'rinadi. Har kim o'zi tanlaydi.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {FON_PRESETS.map((p) => (
              <Thumb key={p.key} k={p.key} label={p.label} bg={p.css} />
            ))}
            <button
              type="button"
              onClick={() => setFon({ ...fon, key: "none" })}
              aria-pressed={fon.key === "none"}
              className={`h-14 rounded-xl border-2 bg-ink-50 text-[10.5px] font-bold text-ink-600 ${fon.key === "none" ? "border-brand-500" : "border-ink-200"}`}
            >
              Oddiy
              <br />
              (fonsiz)
            </button>
            {fon.custom ? (
              <Thumb
                k="custom"
                label="Mening rasmim"
                bg={`url("${fon.custom}")`}
              />
            ) : null}
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="flex h-14 flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-[10.5px] font-semibold text-ink-600 hover:border-brand-400"
            >
              <Upload className="h-4 w-4" />
              {fon.custom ? "Boshqa rasm" : "O'z rasmingiz"}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </div>
          {msg && <p className="mt-2 text-xs text-amber-600">{msg}</p>}
          <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-700">
            Kartalar shaffofligi
            <input
              type="range"
              min={Math.round(GLASS_MIN * 100)}
              max={Math.round(GLASS_MAX * 100)}
              value={Math.round(fon.glass * 100)}
              onChange={(e) =>
                setFon({ ...fon, glass: Number(e.target.value) / 100 })
              }
              className="w-36 accent-brand-600"
              disabled={fon.key === "none"}
            />
          </label>
          <p className="mt-1 text-[11px] text-ink-400">
            Chapga — rasm ko'proq ko'rinadi, o'ngga — kartalar to'qroq.
          </p>
        </div>
      )}
    </div>
  );
}
