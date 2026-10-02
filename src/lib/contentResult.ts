// The video analysis as the model returned it can be off-shape (a list
// sent as a JSON string, a number as text, a cut-off answer). Everything
// the Kontent page shows goes through this first — the same rules as
// meta-webhook/content.js applies before saving.

export type Score = { ball: number; izoh: string };
export type ScoreKey = "boshlanish" | "ekrandagi_matn" | "brend" | "sifat" | "taklif";
export type ContentResult = {
  umumiy_baho: number;
  qisqa_xulosa: string;
  baholar: Partial<Record<ScoreKey, Score>>;
  tavsiyalar: string[];
  matnlar: { uslub: string; matn: string; heshteglar: string }[];
  qayerga: string;
  vaqt: string;
  reklamaga_mos: boolean;
};

const parse = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!/^[[{]/.test(t)) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
};
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 10) / 10)) : 0;
};
const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));

export function normalizeContentResult(raw: unknown): ContentResult | null {
  const r = parse(raw);
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const scoresIn = parse(o.baholar);
  const baholar: ContentResult["baholar"] = {};
  if (scoresIn && typeof scoresIn === "object") {
    for (const [k, v] of Object.entries(scoresIn as Record<string, unknown>)) {
      const s = parse(v);
      if (s && typeof s === "object") baholar[k as ScoreKey] = { ball: num((s as Record<string, unknown>).ball), izoh: str((s as Record<string, unknown>).izoh) };
      else if (s !== undefined) baholar[k as ScoreKey] = { ball: num(s), izoh: "" };
    }
  }
  const tipsIn = parse(o.tavsiyalar);
  const tavsiyalar = Array.isArray(tipsIn) ? tipsIn.map(str).filter(Boolean) : typeof tipsIn === "string" ? tipsIn.split(/\n+/).map((x) => x.replace(/^[\s•\-–\d.)]+/, "").trim()).filter(Boolean) : [];
  const textsIn = parse(o.matnlar);
  const matnlar = (Array.isArray(textsIn) ? textsIn : typeof textsIn === "string" && textsIn.trim() ? [textsIn] : []).map((m) => {
    const x = parse(m);
    if (x && typeof x === "object") {
      const y = x as Record<string, unknown>;
      return { uslub: str(y.uslub), matn: str(y.matn), heshteglar: str(y.heshteglar) };
    }
    return { uslub: "", matn: str(x), heshteglar: "" };
  }).filter((m) => m.matn);
  return {
    umumiy_baho: num(o.umumiy_baho),
    qisqa_xulosa: str(o.qisqa_xulosa),
    baholar,
    tavsiyalar,
    matnlar,
    qayerga: str(o.qayerga),
    vaqt: str(o.vaqt),
    reklamaga_mos: o.reklamaga_mos === true || o.reklamaga_mos === "true",
  };
}
