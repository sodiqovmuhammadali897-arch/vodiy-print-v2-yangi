import { productionCompanyBadge } from "../../lib/orderConstants";

export default function ProductionBadge({ name }: { name: string }) {
  if (!name) return <span className="text-ink-400">-</span>;
  return (
    <span className={`chip border ${productionCompanyBadge(name)}`}>{name}</span>
  );
}
