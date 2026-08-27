import { insertOne, updateOne } from "./firestoreDb";
import type { Brand, Customer, Order } from "./types";

// Keeps a customer's single "Brend" field (Customer.company) in sync with
// the pre-existing multi-brand system (the brands collection, order.brand_id)
// so staff filling in one simple field is enough to make the Hisobot
// "Brendlar bo'yicha daromad" report — which reads real Brand links —
// actually populate, instead of relying on someone separately managing
// brands nobody remembers to add.
// Returns the brand a fresh order for this customer should link to — the
// one just created/renamed, the customer's sole existing brand, or null
// when there's no company name or the customer already has 2+ brands
// (ambiguous; staff is managing those manually, so we don't guess).
export const ensureBrandForCustomer = async (
  customer: Pick<Customer, "id" | "company">,
  existingBrands: Brand[],
): Promise<Brand | null> => {
  const name = customer.company?.trim();
  if (!name) return null;
  const mine = existingBrands.filter((b) => b.customer_id === customer.id);
  if (mine.length === 0) {
    const created = await insertOne<Omit<Brand, "id" | "created_at">>("brands", {
      customer_id: customer.id,
      name,
      logo_url: "",
      note: "",
    });
    return created as Brand;
  }
  if (mine.length === 1) {
    if (mine[0].name !== name) {
      await updateOne("brands", mine[0].id, { name });
    }
    return { ...mine[0], name };
  }
  return null;
};

// Links an order to its customer's brand when the order predates brand
// tracking (or the customer's brand was only just backfilled) and the
// customer has exactly one brand to link to.
export const backfillOrderBrand = async (
  order: Pick<Order, "id" | "brand_id" | "customer_id">,
  brandsByCustomer: Map<string, Brand[]>,
): Promise<void> => {
  if (order.brand_id || !order.customer_id) return;
  const mine = brandsByCustomer.get(order.customer_id) || [];
  if (mine.length === 1) {
    await updateOne("orders", order.id, { brand_id: mine[0].id });
  }
};
