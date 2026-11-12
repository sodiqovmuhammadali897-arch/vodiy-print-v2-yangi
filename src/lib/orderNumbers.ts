// The VP numbers a new order will get, shown on «Tekshirish» before saving
// (the owner's request, 2026-11-12). Several products are saved as several
// orders, one after another, so they get consecutive numbers from the
// next free one. Someone else saving meanwhile shifts them — the list page
// shows the real numbers after saving.
export function orderNumberRange(first: string, count: number): string[] {
  const m = /^VP-(\d+)$/.exec(first || "");
  if (!m || count < 1) return [];
  const start = parseInt(m[1], 10);
  const width = Math.max(3, m[1].length);
  return Array.from({ length: count }, (_, i) => `VP-${String(start + i).padStart(width, "0")}`);
}

// "VP-1048" or "VP-1048 … VP-1052".
export const rangeLabel = (nums: string[]) => (nums.length > 1 ? `${nums[0]} … ${nums[nums.length - 1]}` : nums[0] || "");
