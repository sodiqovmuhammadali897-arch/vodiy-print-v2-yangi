import { insertOne, updateOne } from "./firestoreDb";
import { nextCustomerNumber } from "./numbering";
import { saveOrder } from "./orderService";
import { logLeadActivity } from "./leadActivity";
import { findCustomerByPhone } from "./duplicateCheck";
import type { Lead } from "./types";

// Creates (or reuses, by phone) the real Customer + a minimal Order a
// lead becomes the moment it reaches "Avans" — called from the Kanban
// drag or the status dropdown. From here on the lead's later stages
// (design, production, ready, delivered) are read live off this
// Order's own status rather than tracked separately on the lead.
export const convertLeadToCustomer = async (
  lead: Lead,
  actorEmail: string,
  actorName: string,
): Promise<{ customerId: string; orderId: string; reusedExistingCustomer: boolean }> => {
  const existing = lead.phone ? await findCustomerByPhone(lead.phone) : null;

  let customerId: string;
  let reusedExistingCustomer = false;
  if (existing) {
    customerId = existing.id;
    reusedExistingCustomer = true;
  } else {
    const customer_number = await nextCustomerNumber();
    const [first_name, ...rest] = lead.full_name.trim().split(/\s+/);
    const created = await insertOne("customers", {
      customer_number,
      customer_type: "new",
      source: lead.source,
      industry: lead.industry,
      first_name: first_name || lead.full_name,
      last_name: rest.join(" "),
      phone: lead.phone,
      extra_phone: "",
      telegram: lead.telegram,
      company: lead.brand,
      position: "",
      region: lead.region,
      address: "",
      note: lead.note,
      manager_name: lead.assigned_to_name,
    });
    customerId = created.id;
  }

  const orderResult = await saveOrder(
    {
      order_number: null,
      brand_id: null,
      customer_id: customerId,
      manager_id: null,
      manager_name: lead.assigned_to_name,
      title: lead.interested_product_name || lead.full_name,
      description: lead.note,
      status: "awaiting_advance",
      order_date: new Date().toISOString(),
      deadline: null,
      customer_source: lead.source,
      production_company: "",
      textile_company_id: null,
      textile_company_name: "",
      designer_name: "",
      designer_status: "",
      production_manager: "",
      logistics_manager: "",
      qc_manager: "",
      assigned_printer_email: "",
      assigned_printer_name: "",
      delivery_type: "",
      delivery_address: "",
      delivery_location_url: "",
      delivery_phone: lead.phone,
      courier: "",
      delivery_date: null,
      delivery_time: "",
      delivery_cost: 0,
      payment_type: "",
      telegram_link: lead.telegram,
      customer_note: "",
      production_note: "",
      logistics_note: "",
      private_note: `Lidlar bo'limidan avtomatik yaratildi (${lead.lead_number || lead.id}: ${lead.full_name})`,
      client_request_note: "",
      discount_amount: 0,
      is_draft: true,
      is_historical: false,
      historical_ref: "",
    },
    [],
    [],
    [],
  );

  if ("error" in orderResult) {
    throw new Error(orderResult.error);
  }

  await updateOne("leads", lead.id, {
    status: "advance",
    converted_customer_id: customerId,
    converted_order_id: orderResult.id,
    updated_at: new Date().toISOString(),
  });

  await logLeadActivity(
    lead.id,
    reusedExistingCustomer
      ? "Buyurtmaga aylantirildi (mavjud mijoz profiliga bog'landi)"
      : "Buyurtmaga aylantirildi (yangi mijoz yaratildi)",
    actorEmail,
    actorName,
  );

  return { customerId, orderId: orderResult.id, reusedExistingCustomer };
};
