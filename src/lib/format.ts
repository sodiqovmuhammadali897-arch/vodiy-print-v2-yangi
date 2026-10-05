export const formatMoney = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return v.toLocaleString("uz-UZ", { maximumFractionDigits: 0 }) + " so'm";
};

export const formatMoneyShort = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return sign + (a / 1_000_000_000).toFixed(1) + " mlrd";
  if (a >= 1_000_000) return sign + (a / 1_000_000).toFixed(1) + " mln";
  if (a >= 1_000) return sign + (a / 1_000).toFixed(1) + " ming";
  return sign + Math.round(a).toString();
};

// "05.10.2026" — the browser's own "uz-UZ" format came out as
// "2026 M10 05", which also went onto customer price sheets.
const pad2 = (n: number) => String(n).padStart(2, "0");
const dayOf = (iso: string): string | null => {
  // A plain date is a calendar day already, not a UTC midnight.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export const formatDate = (iso: string | null | undefined): string => (iso && dayOf(iso)) || "-";

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${dayOf(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

export const monthNameUz = (month: number): string =>
  UZ_MONTHS[Math.max(0, Math.min(11, month - 1))];

export const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} daqiqa`;
  return `${hours} soat ${remainingMinutes} daqiqa`;
};

// Strips everything but digits so "+998 90 123 45 67", "998901234567"
// and "90 123 45 67" all compare equal for duplicate-phone lookups.
export const normalizePhone = (phone: string): string => phone.replace(/\D/g, "").slice(-9);

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
