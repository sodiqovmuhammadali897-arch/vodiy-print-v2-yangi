import { Warehouse as WarehouseIcon } from "lucide-react";
import PlaceholderModule from "../../components/ui/PlaceholderModule";

export default function Warehouse() {
  return (
    <PlaceholderModule
      title="Ombor"
      description="Ombor qoldig'i, kirim-chiqim va inventarizatsiya moduli tez orada qo'shiladi."
      icon={<WarehouseIcon className="h-6 w-6" />}
    />
  );
}
