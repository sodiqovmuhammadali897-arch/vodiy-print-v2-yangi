// Count-up for stat numbers: splits a formatted value ("52.3 mln",
// "1 234 567 so'm", "−4.0 ming", 17) into the text around the number and
// the number itself, so the number can run while "mln" / "so'm" stay put.

export type NumberTemplate = {
  prefix: string;
  suffix: string;
  value: number;
  decimals: number;
  group: string; // thousands separator, "" when none
  point: string; // decimal separator
};

const SPACES = [" ", "\u00a0", "\u202f"];

// Only values that come back exactly the same when re-formatted are run —
// dates, times, "3/5" and the like are left as they are.
export const parseNumberTemplate = (input: unknown): NumberTemplate | null => {
  const t = parseLoose(input);
  if (!t || /\d/.test(t.prefix + t.suffix)) return null;
  return formatTemplate(t, t.value) === (typeof input === "number" ? formatTemplate(t, t.value) : input) ? t : null;
};

const parseLoose = (input: unknown): NumberTemplate | null => {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const decimals = Number.isInteger(input) ? 0 : Math.min(2, String(input).split(".")[1]?.length || 0);
    return { prefix: input < 0 ? "-" : "", suffix: "", value: Math.abs(input), decimals, group: "", point: "." };
  }
  if (typeof input !== "string") return null;
  const m = /\d(?:[\d\s\u00a0\u202f.,]*\d)?/.exec(input);
  if (!m) return null;
  const token = m[0];
  const prefix = input.slice(0, m.index);
  const suffix = input.slice(m.index + token.length);
  // Spaces inside a number only appear as thousands separators.
  const group = SPACES.find((s) => token.includes(s)) || "";
  let point = ".";
  let decimals = 0;
  let digits = token;
  const seps = token.replace(/[\d\s\u00a0\u202f]/g, "");
  if (seps) {
    const last = seps[seps.length - 1];
    const tail = token.slice(token.lastIndexOf(last) + 1);
    // "1,234,567" or a lone "1.000" is grouping; "52.3", "1 234,50" are decimals.
    const isGrouping = !group && (seps.length > 1 ? seps.split("").every((c) => c === last) : tail.length === 3);
    if (isGrouping) {
      digits = token.split(last).join("");
      return { prefix, suffix, value: Number(digits), decimals: 0, group: last, point: "." };
    }
    point = last;
    decimals = tail.length;
    digits = token.slice(0, token.lastIndexOf(last)).replace(/[^\d]/g, "") + "." + tail;
  }
  const value = Number(digits.replace(/[\s\u00a0\u202f]/g, ""));
  if (!Number.isFinite(value)) return null;
  return { prefix, suffix, value, decimals, group, point };
};

export const formatTemplate = (t: NumberTemplate, value: number): string => {
  const [int, frac] = Math.abs(value).toFixed(t.decimals).split(".");
  const grouped = t.group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, t.group) : int;
  return `${t.prefix}${grouped}${frac ? t.point + frac : ""}${t.suffix}`;
};

// Same shape (text around the number and decimals): the number can run
// from the old value to the new one. Otherwise the unit changed ("mln" →
// "ming") and running between the two numbers would mislead, so start at 0.
export const sameShape = (a: NumberTemplate | null, b: NumberTemplate | null) =>
  Boolean(a && b && a.prefix === b.prefix && a.suffix === b.suffix && a.decimals === b.decimals);

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

export const COUNT_UP_MS = 1000;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
