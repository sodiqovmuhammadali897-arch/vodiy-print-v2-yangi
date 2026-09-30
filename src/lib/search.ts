// Search that forgives how an order number is typed: "vp 126", "VP-126",
// "vp126" and "126" all find VP-126 (and VP-0126), but not VP-1260.
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// The number in a query that looks like an order number ("vp 126", "126"),
// without leading zeros; null for anything else.
export const orderNumberQuery = (q: string): string | null => {
  const m = /^(vp)?0*(\d+)$/.exec(squash(q));
  return m ? m[2] : null;
};

export const isOrderNumber = (orderNumber: string | null | undefined, digits: string) =>
  String(orderNumber || "").replace(/\D/g, "").replace(/^0+/, "") === digits;

// True when the query is in any of the fields, spacing and dashes aside.
export const textMatches = (q: string, fields: (string | number | null | undefined)[]) => {
  const needle = squash(q);
  if (!needle) return true;
  const plain = q.trim().toLowerCase();
  return fields.some((f) => {
    const v = String(f ?? "");
    return v.toLowerCase().includes(plain) || squash(v).includes(needle);
  });
};
