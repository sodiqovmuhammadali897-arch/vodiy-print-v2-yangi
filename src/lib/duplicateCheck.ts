import { listAll } from "./firestoreDb";
import { normalizePhone } from "./format";
import type { Customer, Lead } from "./types";

export const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  const target = normalizePhone(phone);
  if (!target) return null;
  const customers = await listAll<Customer>("customers");
  return customers.find((c) => normalizePhone(c.phone) === target) || null;
};

export const findLeadByPhone = async (phone: string, excludeId?: string): Promise<Lead | null> => {
  const target = normalizePhone(phone);
  if (!target) return null;
  const leads = await listAll<Lead>("leads");
  return leads.find((l) => l.id !== excludeId && normalizePhone(l.phone) === target) || null;
};
