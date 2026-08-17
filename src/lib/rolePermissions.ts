import type { AuthContextValue } from "./AuthContext";

// Cost price and margin already never leave the server for a non-admin
// (product_costs is admin-only at the Firestore rules level) — these
// helpers exist so the UI hides the same data proactively instead of
// rendering an empty/broken cell, and so every screen asks the same
// question the same way.
export const canViewCostPrice = (auth: Pick<AuthContextValue, "isAdmin">): boolean =>
  auth.isAdmin;

export const canEditCostPrice = (auth: Pick<AuthContextValue, "isAdmin">): boolean =>
  auth.isAdmin;

export const canViewMargin = (auth: Pick<AuthContextValue, "isAdmin">): boolean =>
  auth.isAdmin;

export const canExportCustomerPrice = (auth: Pick<AuthContextValue, "can">): boolean =>
  auth.can("products", "view");
