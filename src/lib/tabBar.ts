// Which four pages sit in the phone's tab bar: a set that fits the
// person's work, if they can open all of it; otherwise as much of the
// preferred pages as they can open, filled up in sidebar order.

export const TAB_SETS = {
  leader: ["/dashboard", "/orders", "/finance", "/reports"],
  sales: ["/dashboard", "/leads", "/orders", "/customers"],
  production: ["/dashboard", "/production", "/orders", "/tasks"],
  pechatnik: ["/dashboard", "/pechatnik", "/orders", "/tasks"],
};

export const TAB_COUNT = 4;

export const pickTabs = (visible: string[], leader: boolean): string[] => {
  const order = leader
    ? [TAB_SETS.leader, TAB_SETS.sales, TAB_SETS.production, TAB_SETS.pechatnik]
    : [TAB_SETS.sales, TAB_SETS.production, TAB_SETS.pechatnik];
  const can = new Set(visible);
  const full = order.find((set) => set.every((p) => can.has(p)));
  if (full) return full;
  return [...new Set([...order.flat().filter((p) => can.has(p)), ...visible])].slice(0, TAB_COUNT);
};

// The tab a page belongs to: "/orders/12" → "/orders".
export const tabOf = (pathname: string, tabs: string[]): string | null =>
  tabs.find((t) => pathname === t || pathname.startsWith(t + "/")) || null;
