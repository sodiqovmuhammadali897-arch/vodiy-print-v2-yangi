// An order is not entered without the customer's region (the owner,
// 2026-11-23: «manager buyurtma kirgizayotganda viloyatni tanlamasa buyurtma
// kirgizilmasin»). The region lives on the customer, so a new order — or a
// draft being turned into a real one — needs a customer with a region. A
// draft («Qoralama») can still be kept without it, and orders entered before
// this rule can be edited as before.
export function regionProblem(
  customer: { region?: string | null } | null,
  o: { asDraft: boolean; isNew: boolean; wasDraft: boolean },
): string | null {
  if (o.asDraft || !(o.isNew || o.wasDraft)) return null;
  if (!customer) return "Mijozni tanlang va uning viloyatini belgilang — mijoz va viloyatsiz buyurtma kiritilmaydi.";
  if (!String(customer.region || "").trim()) return "Mijozning viloyatini tanlang («Mijoz» qadamida) — viloyatsiz buyurtma kiritilmaydi.";
  return null;
}
