import { useEffect } from "react";
import { useAuth } from "./AuthContext";
import { warmCollections } from "./firestoreDb";
import { prefetchPages } from "../pages";

// Right after sign-in, while the first page is on screen, load what the
// other pages will ask for: the shared collections this person may read
// (same conditions as firestore.rules — a refused one would only error)
// and the code of the pages.
export function useWarmup(): void {
  const { user, staff, staffLoading, isAdmin, isManagerAccount, can } = useAuth();
  useEffect(() => {
    if (!user || staffLoading || !staff) return;
    const names: string[] = [];
    if (can("orders", "view") || can("production", "view") || can("pechatnik", "view")) names.push("orders", "order_products");
    if (can("orders", "view")) names.push("order_payments");
    if (can("customers", "view") || can("production", "view") || can("pechatnik", "view") || can("proposals", "view")) names.push("customers");
    if (can("products", "view") || can("textile", "view") || can("proposals", "view") || can("leads", "view")) names.push("products");
    if (can("finance", "view")) names.push("expenses");
    if (isAdmin && !isManagerAccount) names.push("order_costs", "product_costs");
    // Let the page being opened go first.
    const t = setTimeout(() => {
      warmCollections(names);
      prefetchPages();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, staff, staffLoading]);
}
