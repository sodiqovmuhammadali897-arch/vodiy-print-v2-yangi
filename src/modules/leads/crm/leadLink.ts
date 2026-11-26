import { useCallback } from "react";
import { useLocation } from "react-router-dom";

// Where a lead opens: inside Sotuv bo'limi (/leads) in the right-side panel
// (?lead=ID next to the current section), anywhere else on its own page.
export function useLeadHref() {
  const { pathname, search } = useLocation();
  return useCallback(
    (id: string) => {
      if (pathname !== "/leads") return `/leads/${id}`;
      const p = new URLSearchParams(search);
      p.set("lead", id);
      return `/leads?${p.toString()}`;
    },
    [pathname, search],
  );
}
