import { supabase } from "./supabase";
import type { OrderPayment, OrderProduct } from "./types";
import { nextOrderNumber } from "./numbering";
import { computeOrderTotals } from "./orderCalculations";

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
};

const upsertChildren = async (
  orderId: string,
  products: WizardProduct[],
  payments: WizardPayment[],
  fileLinks: WizardFileLink[],
) => {
  await supabase.from("order_products").delete().eq("order_id", orderId);
  if (products.length > 0) {
    await supabase.from("order_products").insert(
      products.map((p, i) => ({
        ...p,
        order_id: orderId,
        position: i,
      })),
    );
  }
  await supabase.from("order_payments").delete().eq("order_id", orderId);
  if (payments.length > 0) {
    await supabase.from("order_payments").insert(
      payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ ...p, order_id: orderId })),
    );
  }
  await supabase.from("order_files").delete().eq("order_id", orderId);
  if (fileLinks.length > 0) {
    await supabase.from("order_files").insert(
      fileLinks
        .filter((f) => f.url.trim())
        .map((f) => ({
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
): Promise<{ id: string; order_number: string } | { error: string }> => {
  const totals = computeOrderTotals(products, payload.discount_amount, payments);

  let orderNumber = payload.order_number;
  if (!payload.id && !orderNumber) {
    orderNumber = await nextOrderNumber();
  }

  const record = {
    ...payload,
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

  let orderId = payload.id;
  if (orderId) {
    const { error } = await supabase.from("orders").update(record).eq("id", orderId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("orders")
      .insert(record)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: error?.message || "Xatolik" };
    orderId = data.id;
  }

  await upsertChildren(orderId!, products, payments, fileLinks);

  if (record.customer_id) {
    await maybePromoteCustomer(record.customer_id);
  }

  return { id: orderId!, order_number: orderNumber || "" };
};

const maybePromoteCustomer = async (customerId: string) => {
  const { data } = await supabase
    .from("customers")
    .select("customer_type")
    .eq("id", customerId)
    .maybeSingle();
  const type = (data as { customer_type: string } | null)?.customer_type;
  if (type && (type === "regular" || type === "vip")) return;
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if ((count || 0) >= 2) {
    await supabase
      .from("customers")
      .update({ customer_type: "regular" })
      .eq("id", customerId);
  }
};
