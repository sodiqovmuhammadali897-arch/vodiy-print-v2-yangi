import { useCallback, useEffect, useState } from "react";
import { getOne, listAll } from "../../../lib/firestoreDb";
import { digitsOf } from "../../../lib/crmBase";
import type { CrmBaseDoc } from "../../../lib/types";

// The whole base, read once per few minutes (3 000+ customers — not a live
// subscription, so switching sections does not read it again).
let cache: { at: number; rows: CrmBaseDoc[] } | null = null;
const TTL = 5 * 60 * 1000;

export function useBase() {
  const [rows, setRows] = useState<CrmBaseDoc[] | null>(cache && Date.now() - cache.at < TTL ? cache.rows : null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < TTL) return setRows(cache.rows);
    try {
      const list = await listAll<CrmBaseDoc>("crm_base");
      cache = { at: Date.now(), rows: list };
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'qib bo'lmadi");
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // A local change (reopened) without reading everything again.
  const patch = useCallback((id: string, p: Partial<CrmBaseDoc>) => {
    setRows((cur) => {
      const next = (cur || []).map((r) => (r.id === id ? { ...r, ...p } : r));
      if (cache) cache = { ...cache, rows: next };
      return next;
    });
  }, []);
  return { rows, error, reload: () => load(true), patch };
}

// One phone's history (lead card).
export function useBaseOf(phone: string | null | undefined) {
  const d = digitsOf(phone);
  const [doc, setDoc] = useState<CrmBaseDoc | null>(null);
  useEffect(() => {
    setDoc(null);
    if (d.length < 9) return;
    let live = true;
    getOne<CrmBaseDoc>("crm_base", d)
      .then((x) => live && setDoc(x || null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [d]);
  return doc;
}
