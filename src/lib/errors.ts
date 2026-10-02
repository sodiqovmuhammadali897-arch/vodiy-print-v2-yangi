// Firebase answers in English ("Missing or insufficient permissions.").
// Staff need to know what is missing and who can fix it.
export const isPermissionDenied = (e: unknown): boolean =>
  (e as { code?: string })?.code === "permission-denied" || /insufficient permissions/i.test(String((e as Error)?.message || ""));

export const friendlyError = (e: unknown, need?: string): string => {
  if (isPermissionDenied(e)) {
    return need
      ? `Ruxsat yo'q: ${need}. Admin Sozlamalar → Xodimlar bo'limida shu ruxsatni bersin.`
      : "Bu amal uchun ruxsatingiz yo'q. Admin Sozlamalar → Xodimlar bo'limida ruxsat bersin.";
  }
  const code = (e as { code?: string })?.code;
  if (code === "unavailable" || /network|failed to fetch/i.test(String((e as Error)?.message || ""))) return "Internet bilan aloqa yo'q — qayta urinib ko'ring";
  return e instanceof Error && e.message ? e.message : "Xatolik yuz berdi";
};
