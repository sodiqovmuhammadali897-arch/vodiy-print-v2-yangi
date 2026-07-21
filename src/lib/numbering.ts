import { supabase } from "./supabase";

const pad = (n: number, width = 3) => String(n).padStart(width, "0");

const nextSequence = (values: (string | null)[], prefix: string): number => {
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
  const { data } = await supabase.from("orders").select("order_number");
  const values = ((data as { order_number: string | null }[]) || []).map(
    (r) => r.order_number,
  );
  return `VP-${pad(nextSequence(values, "VP"))}`;
};

export const nextCustomerNumber = async (): Promise<string> => {
  const { data } = await supabase.from("customers").select("customer_number");
  const values = ((data as { customer_number: string | null }[]) || []).map(
    (r) => r.customer_number,
  );
  return `CL-${pad(nextSequence(values, "CL"))}`;
};
