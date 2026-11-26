import { useEffect, useState } from "react";
import { subscribeOne, upsertOne } from "../../../lib/firestoreDb";

// Is the new Sotuv bo'limi open to managers? (step 4, 2026-11-26). The owner
// flips it in the section's menu; until then managers keep their amoCRM view.
// crm_settings/main.open_to_managers — read by every staff member.
export function useCrmOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => subscribeOne<{ open_to_managers?: boolean }>("crm_settings", "main", (d) => setOpen(Boolean(d && d.open_to_managers))), []);
  return open;
}

export const setCrmOpen = (open: boolean, by: string) => upsertOne("crm_settings", "main", { open_to_managers: open, changed_by: by, changed_at: new Date().toISOString() });

// Is the amoCRM sync still on? (step 6, crm_settings/main.amo_sync; on unless set false)
export function useAmoSync(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => subscribeOne<{ amo_sync?: boolean }>("crm_settings", "main", (d) => setOn(!(d && d.amo_sync === false))), []);
  return on;
}
