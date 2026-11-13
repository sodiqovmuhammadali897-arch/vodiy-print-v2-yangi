// Sotuv bo'limi's background picture (the owner, 2026-11-13: «amoCRM'day
// fon qo'ysa bo'ladigan»). Each person picks their own; it is kept in this
// browser only (localStorage), so nothing is written to the database.
// The pictures are public/fon/*.svg; «O'z rasmingiz» is a file the person
// picks, made smaller and kept as a data URL.

// `shade`: a dark veil over light pictures so white text stays readable.
export type FonPreset = {
  key: string;
  label: string;
  css: string;
  shade: number;
};

export const FON_PRESETS: FonPreset[] = [
  {
    key: "mountains",
    label: "Tog'lar",
    css: "url(/fon/mountains.svg)",
    shade: 0.1,
  },
  {
    key: "aurora",
    label: "Shimoliy nur",
    css: "url(/fon/aurora.svg)",
    shade: 0,
  },
  { key: "sunrise", label: "Tong", css: "url(/fon/sunrise.svg)", shade: 0.45 },
  { key: "sea", label: "Dengiz", css: "url(/fon/sea.svg)", shade: 0.05 },
  { key: "hills", label: "Adirlar", css: "url(/fon/hills.svg)", shade: 0.5 },
  {
    key: "night",
    label: "Tun",
    css: "linear-gradient(135deg, #0f172a, #1e3a8a)",
    shade: 0,
  },
];
// One's own photo: unknown, so a middle veil.
const CUSTOM_SHADE = 0.35;
const veil = (a: number) =>
  a > 0 ? `linear-gradient(rgb(2 6 23 / ${a}), rgb(2 6 23 / ${a})), ` : "";

export type FonState = { key: string; custom?: string; glass: number };
// New people start on «Tog'lar»; «Oddiy (fonsiz)» brings the plain page back.
export const FON_DEFAULT: FonState = { key: "mountains", glass: 0.5 };
// How see-through the cards are: 0.3 (much picture) … 0.85 (almost solid).
export const GLASS_MIN = 0.3;
export const GLASS_MAX = 0.85;

const storeKey = (email: string) => `vp_fon_${email || "anon"}`;

export function loadFon(email: string): FonState {
  try {
    const raw = localStorage.getItem(storeKey(email));
    if (!raw) return FON_DEFAULT;
    const v = JSON.parse(raw) as Partial<FonState>;
    const glass = Math.min(
      GLASS_MAX,
      Math.max(GLASS_MIN, Number(v.glass) || FON_DEFAULT.glass),
    );
    return {
      key: typeof v.key === "string" ? v.key : FON_DEFAULT.key,
      custom: typeof v.custom === "string" ? v.custom : undefined,
      glass,
    };
  } catch {
    return FON_DEFAULT;
  }
}

// false when the browser refused (a private window, or the picture is too big).
export function saveFon(email: string, s: FonState): boolean {
  try {
    localStorage.setItem(storeKey(email), JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

// The CSS background for a state, or "" for none.
export function fonCss(s: FonState): string {
  if (s.key === "custom")
    return s.custom ? `${veil(CUSTOM_SHADE)}url("${s.custom}")` : "";
  const p = FON_PRESETS.find((x) => x.key === s.key);
  return p ? `${veil(p.shade)}${p.css}` : "";
}

// The longer side of a picked photo is brought down to `max` px, as JPEG.
export const fitSize = (w: number, h: number, max = 1920) => {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
};

export function shrinkImage(
  file: File,
  max = 1920,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { w, h } = fitSize(img.naturalWidth, img.naturalHeight, max);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni ochib bo'lmadi"));
    };
    img.src = url;
  });
}
