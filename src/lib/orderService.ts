import type { OrderPayment, OrderProduct } from "./types";
import { nextOrderNumber } from "./numbering";
import { computeOrderTotals } from "./orderCalculations";
import {
  countWhere,
  deleteWhere,
  getOne,
  insertMany,
  insertOne,
  updateOne,
} from "./firestoreDb";

export type WizardProduct = Omit<OrderProduct, "id" | "order_id">;
export type WizardPayment = Omit<OrderPayment, "id" | "order_id" | "created_at">;
export type WizardFileLink = {
  id?: string;
  filename: string;
  url: string;
  link_type: string;
  note: string;
};

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
};

const upsertChildren = async (
  orderId: string,
  products: WizardProduct[],
  payments: WizardPayment[],
  fileLinks: WizardFileLink[],
) => {
  await deleteWhere("order_products", "order_id", orderId);
  if (products.length > 0) {
    await insertMany(
      "order_products",
      products.map((p, i) => ({
        ...p,
        order_id: orderId,
        position: i,
      })),
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
  const filesToAdd = fileLinks.filter((f) => f.url.trim());
  if (filesToAdd.length > 0) {
    await insertMany(
      "order_files",
      filesToAdd.map((f) => ({
        order_id: orderId,
        filename: f.filename || "Havola",
        url: f.url,
        link_type: f.link_type,
        note: f.note,
        mime_type: "text/uri-list",
        size: 0,
      })),
    );
  }
};

export const saveOrder = async (
  payload: OrderPayload,
  products: WizardProduct[],
  payments: WizardPayment[],
  fileLinks: WizardFileLink[],
  statusChange?: { previousStatus: string; actorEmail: string; actorName: string },
): Promise<{ id: string; order_number: string } | { error: string }> => {
  const totals = computeOrderTotals(products, payload.discount_amount, payments);

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
    completed_at:
      payload.status === "delivered" || payload.status === "closed"
        ? new Date().toISOString()
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

    await upsertChildren(orderId, products, payments, fileLinks);

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
  const count = await countWhere("orders", "customer_id", customerId);
  if (count >= 2) {
    await updateOne("customers", customerId, { customer_type: "regular" });
  }
};
