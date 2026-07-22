import { listAll } from "./firestoreDb";

const pad = (n: number, width = 3) => String(n).padStart(width, "0");

const nextSequence = (values: (string | null | undefined)[], prefix: string): number => {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const v of values) {
    if (!v) continue;
    const m = v.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
};

export const nextOrderNumber = async (): Promise<string> => {
  const rows = await listAll<{ order_number: string | null }>("orders");
  return `VP-${pad(nextSequence(rows.map((r) => r.order_number), "VP"))}`;
};

export const nextCustomerNumber = async (): Promise<string> => {
  const rows = await listAll<{ customer_number: string | null }>("customers");
  return `CL-${pad(nextSequence(rows.map((r) => r.customer_number), "CL"))}`;
};

export const nextTextileCompanyNumber = async (): Promise<string> => {
  const rows = await listAll<{ company_number: string | null }>("textile_companies");
  return `TXT-${pad(nextSequence(rows.map((r) => r.company_number), "TXT"))}`;
};
