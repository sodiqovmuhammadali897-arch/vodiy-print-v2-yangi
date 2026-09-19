import type { AuthContextValue } from "./AuthContext";

// Cost price and margin are admin-only at the Firestore rules level —
// these helpers exist so the UI hides the same data proactively instead
// of rendering an empty/broken cell, and so every screen asks the same
// question the same way. A staff member explicitly linked to a manager
// profile (isManagerAccount) is excluded even when role=admin: manager
// accounts are routinely created with role=admin just to grant them
// full module access, and they should still get the customer-facing
// view, never cost price/margin.
type CostAuth = Pick<AuthContextValue, "isAdmin" | "isManagerAccount">;

export const canViewCostPrice = (auth: CostAuth): boolean =>
  auth.isAdmin && !auth.isManagerAccount;

export const canEditCostPrice = (auth: CostAuth): boolean =>
  auth.isAdmin && !auth.isManagerAccount;

export const canViewMargin = (auth: CostAuth): boolean =>
  auth.isAdmin && !auth.isManagerAccount;

export const canExportCustomerPrice = (auth: Pick<AuthContextValue, "can">): boolean =>
  auth.can("products", "view");
