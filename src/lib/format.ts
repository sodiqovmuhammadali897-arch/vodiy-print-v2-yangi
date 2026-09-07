export const formatMoney = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return v.toLocaleString("uz-UZ", { maximumFractionDigits: 0 }) + " so'm";
};

export const formatMoneyShort = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + " mlrd";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + " mln";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + " ming";
  return v.toString();
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
