import { useEffect, useMemo, useState } from "react";
import { subscribeAll } from "../../../lib/firestoreDb";
import { contactIndex, type CrmContact } from "../../../lib/contacts";

// The Kontaktlar list, live, and its digits → contact index for calls.
export function useContacts() {
  const [list, setList] = useState<CrmContact[] | null>(null);
  useEffect(() => subscribeAll<CrmContact>("crm_contacts", (rows) => setList(rows), undefined), []);
  const index = useMemo(() => contactIndex(list || []), [list]);
  return { contacts: list, index };
}
