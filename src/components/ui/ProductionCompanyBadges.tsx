import ProductionBadge from "./ProductionBadge";

// Different products on the same order can go to different outsource
// companies, so we show one badge per distinct non-empty value instead of
// a single order-level company.
export default function ProductionCompanyBadges({ companies }: { companies: string[] }) {
  const distinct = Array.from(new Set(companies.map((c) => c?.trim()).filter(Boolean)));
  if (distinct.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {distinct.map((name) => (
        <ProductionBadge key={name} name={name} />
      ))}
    </div>
  );
}
