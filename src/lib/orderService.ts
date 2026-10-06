import type { OrderPayment, OrderProduct } from "./types";
import { nextOrderNumber } from "./numbering";
import { computeOrderTotals } from "./orderCalculations";
import { formatMoney } from "./format";
import {
  deleteWhere,
  getOne,
  insertMany,
  insertOne,
  listWhere,
  updateOne,
} from "./firestoreDb";

export type WizardFileLink = {
  id?: string;
  filename: string;
  url: string;
  link_type: string;
  note: string;
};
// Files live on the product line they belong to, not on the order as a
// whole — an order with several products would otherwise have no way to
// tell which uploaded file/link goes with which one.
export type WizardProduct = Omit<OrderProduct, "id" | "order_id"> & { files: WizardFileLink[] };
export type WizardPayment = Omit<OrderPayment, "id" | "order_id" | "created_at">;

export type OrderPayload = {
  id?: string;
  order_number: string | null;
  brand_id: string | null;
  customer_id: string | null;
  manager_id: string | null;
  manager_name: string;
  title: string;
  description: string;
  status: string;
  order_date: string | null;
  deadline: string | null;
  customer_source: string;
  production_company: string;
  textile_company_id: string | null;
  textile_company_name: string;
  designer_name: string;
  designer_status: string;
  production_manager: string;
  logistics_manager: string;
  qc_manager: string;
  assigned_printer_email: string;
  assigned_printer_name: string;
  delivery_type: string;
  delivery_address: string;
  delivery_location_url: string;
  delivery_phone: string;
  courier: string;
  delivery_date: string | null;
  delivery_time: string;
  delivery_cost: number;
  payment_type: string;
  telegram_link: string;
  customer_note: string;
  production_note: string;
  logistics_note: string;
  private_note: string;
  client_request_note: string;
  discount_amount: number;
  is_draft: boolean;
  is_historical: boolean;
  historical_ref: string;
  // Excel import (importService.ts): which run created it, a stable key
  // against importing the same rows twice, and the real entry date.
  import_batch?: string;
  import_key?: string;
  created_at?: string;
};

// Children are rewritten as delete-then-insert; two saves of the same order
// running at once (a double click) would both delete and then both insert,
// leaving every line twice. Saves of one order therefore run one after
// another.
const childWrites = new Map<string, Promise<unknown>>();
const upsertChildren = (orderId: string, products: WizardProduct[], payments: WizardPayment[]) => {
  const run = (childWrites.get(orderId) || Promise.resolve())
    .catch(() => undefined)
    .then(() => writeChildren(orderId, products, payments));
  childWrites.set(orderId, run);
  return run;
};

const writeChildren = async (
  orderId: string,
  products: WizardProduct[],
  payments: WizardPayment[],
) => {
  await deleteWhere("order_products", "order_id", orderId);
  if (products.length > 0) {
    await insertMany(
      "order_products",
      products.map((p, i) => {
        const { files: _files, ...rest } = p;
        return { ...rest, order_id: orderId, position: i };
      }),
    );
  }

  await deleteWhere("order_payments", "order_id", orderId);
  if (payments.length > 0) {
    await insertMany(
      "order_payments",
      payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ ...p, order_id: orderId })),
    );
  }

  await deleteWhere("order_files", "order_id", orderId);
  const filesToAdd = products.flatMap((p, i) =>
    p.files
      .filter((f) => f.url.trim())
      .map((f) => ({
        order_id: orderId,
        product_position: i,
        filename: f.filename || "Havola",
        url: f.url,
        link_type: f.link_type,
        note: f.note,
        mime_type: "text/uri-list",
        size: 0,
      })),
  );
  if (filesToAdd.length > 0) {
    await insertMany("order_files", filesToAdd);
  }
};

export const saveOrder = async (
  payload: OrderPayload,
  products: WizardProduct[],
  payments: WizardPayment[],
  statusChange?: { previousStatus: string; actorEmail: string; actorName: string },
): Promise<{ id: string; order_number: string } | { error: string }> => {
  const totals = computeOrderTotals(products, payload.discount_amount, payments);

  // Historical backfills are exempt — an old order can legitimately be
  // archived with real, still-owed debt from before the ERP existed.
  if (payload.status === "closed" && !payload.is_historical && totals.remaining > 0) {
    return {
      error: `Bu buyurtmada ${formatMoney(totals.remaining)} qarzdorlik bor — avval to'lovni kiritmasdan yopib bo'lmaydi.`,
    };
  }

  let orderNumber = payload.order_number;
  if (!payload.id && !orderNumber) {
    orderNumber = await nextOrderNumber();
  }

  const { id: _ignored, ...rest } = payload;
  const record = {
    ...rest,
    order_number: orderNumber,
    subtotal: totals.subtotal,
    total_amount: totals.total,
    paid_amount: totals.paid,
    remaining_amount: totals.remaining,
    // A backfilled order was finished on its own date, not today.
    completed_at:
      payload.status === "delivered" || payload.status === "closed"
        ? payload.is_historical && payload.order_date
          ? `${payload.order_date.slice(0, 10)}T12:00:00.000Z`
          : new Date().toISOString()
        : null,
  };

  try {
    let orderId = payload.id;
    if (orderId) {
      await updateOne("orders", orderId, record);
    } else {
      const created = await insertOne("orders", record);
      orderId = created.id;
    }

    await upsertChildren(orderId, products, payments);

    if (record.customer_id) {
      await maybePromoteCustomer(record.customer_id);
    }

    if (statusChange && statusChange.previousStatus !== record.status) {
      await insertOne("order_status_history", {
        order_id: orderId,
        status: record.status,
        changed_by_email: statusChange.actorEmail,
        changed_by_name: statusChange.actorName || statusChange.actorEmail,
        changed_at: new Date().toISOString(),
      });
    }

    return { id: orderId, order_number: orderNumber || "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Xatolik";
    return { error: message };
  }
};

export const maybePromoteCustomer = async (customerId: string) => {
  const customer = await getOne<{ customer_type: string }>("customers", customerId);
  const type = customer?.customer_type;
  if (type === "regular" || type === "vip") return;
  // A repeat customer came back on another day: several orders placed
  // together (one per product) are still a first visit.
  const orders = await listWhere<{ order_date?: string | null; created_at?: string | null }>("orders", "customer_id", customerId);
  const days = new Set(orders.map((o) => String(o.order_date || o.created_at || "").slice(0, 10)).filter(Boolean));
  if (days.size >= 2) {
    await updateOne("customers", customerId, { customer_type: "regular" });
  }
};
