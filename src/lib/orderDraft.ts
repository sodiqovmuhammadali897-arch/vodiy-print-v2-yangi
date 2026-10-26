// An order being typed in the wizard is kept on this device while it is
// typed, so leaving for another page (or closing the app) loses nothing:
// the wizard opens where it was left, and the orders list offers to
// continue it. Removed once the order is saved. Per person and per order
// ("new" for a new one).
import type { OrderPayload, WizardPayment, WizardProduct } from "./orderService";

export type OrderDraft = {
  payload: OrderPayload;
  products: WizardProduct[];
  payments: WizardPayment[];
  step: number;
  saved_at: string;
};

const keyOf = (email: string, orderId: string) => `vp_order_draft:${email.toLowerCase()}:${orderId}`;

// Something worth keeping: a customer, a name or a product line.
export const hasContent = (d: Pick<OrderDraft, "payload" | "products" | "payments">) =>
  Boolean(d.payload.customer_id || d.payload.title.trim() || d.products.some((p) => p.product_name.trim() || p.quantity > 0) || d.payments.length);

export const readDraft = (email: string, orderId: string): OrderDraft | null => {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(keyOf(email, orderId));
    if (!raw) return null;
    const d = JSON.parse(raw) as OrderDraft;
    return d && d.payload && Array.isArray(d.products) && Array.isArray(d.payments) ? d : null;
  } catch {
    return null;
  }
};

export const writeDraft = (email: string, orderId: string, d: Omit<OrderDraft, "saved_at">) => {
  if (!email) return;
  try {
    // An empty wizard never wipes a kept draft; only saving or «Yangidan
    // boshlash» does (clearDraft).
    if (hasContent(d)) localStorage.setItem(keyOf(email, orderId), JSON.stringify({ ...d, saved_at: new Date().toISOString() }));
  } catch {
    // Storage full or blocked: the wizard still works, only without the copy.
  }
};

export const clearDraft = (email: string, orderId: string) => {
  try {
    localStorage.removeItem(keyOf(email, orderId));
  } catch {
    // nothing to clear
  }
};

// "Paket A4, Flayer" — what the draft is about, for the orders list.
export const draftSummary = (d: OrderDraft) => {
  const names = d.products.map((p) => p.product_name.trim()).filter(Boolean);
  return names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? ` va yana ${names.length - 3} ta` : "") : d.payload.title.trim() || "mahsulot hali tanlanmagan";
};
