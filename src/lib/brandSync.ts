import { insertOne, updateOne } from "./firestoreDb";
import type { Brand, Customer, Order } from "./types";

// Keeps a customer's single "Brend" field (Customer.company) in sync with
// the pre-existing multi-brand system (the brands collection, order.brand_id)
// so staff filling in one simple field is enough to make the Hisobot
// "Brendlar bo'yicha daromad" report — which reads real Brand links —
// actually populate, instead of relying on someone separately managing
// brands nobody remembers to add.
export const ensureBrandForCustomer = async (
  customer: Pick<Customer, "id" | "company">,
  existingBrands: Brand[],
): Promise<void> => {
  const name = customer.company?.trim();
  if (!name) return;
  const mine = existingBrands.filter((b) => b.customer_id === customer.id);
  if (mine.length === 0) {
    await insertOne<Omit<Brand, "id" | "created_at">>("brands", {
      customer_id: customer.id,
      name,
      logo_url: "",
      note: "",
    });
  } else if (mine.length === 1 && mine[0].name !== name) {
    await updateOne("brands", mine[0].id, { name });
  }
  // 2+ brands already on this customer: staff is managing multiple
  // manually, leave them alone rather than guessing which one to rename.
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
