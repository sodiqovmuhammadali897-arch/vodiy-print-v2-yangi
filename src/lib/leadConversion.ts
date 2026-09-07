import { insertOne, updateOne } from "./firestoreDb";
import { nextCustomerNumber } from "./numbering";
import type { Lead } from "./types";

// Creates the real Customer record a won lead becomes, and marks the lead
// itself won + linked — called the moment a lead's card is dragged/moved
// to the "Mijozga aylandi" column.
export const convertLeadToCustomer = async (lead: Lead): Promise<string> => {
  const customer_number = await nextCustomerNumber();
  const [first_name, ...rest] = lead.full_name.trim().split(/\s+/);
  const created = await insertOne("customers", {
    customer_number,
    customer_type: "new",
    source: lead.source,
    industry: "",
    first_name: first_name || lead.full_name,
    last_name: rest.join(" "),
    phone: lead.phone,
    extra_phone: "",
    telegram: "",
    company: "",
    position: "",
    region: "",
    address: "",
    note: lead.note,
    manager_name: lead.assigned_to_name,
  });

  await updateOne("leads", lead.id, {
    status: "won",
    converted_customer_id: created.id,
    updated_at: new Date().toISOString(),
  });

  return created.id;
};
