import { customerTypeInfo } from "../../lib/orderConstants";

export default function CustomerTypeBadge({ type }: { type: string }) {
  const info = customerTypeInfo(type);
  return <span className={`chip ${info.cls}`}>{info.label}</span>;
}
