import { ChartBar as BarChart3 } from "lucide-react";
import PlaceholderModule from "../../components/ui/PlaceholderModule";

export default function Reports() {
  return (
    <PlaceholderModule
      title="Hisobot"
      description="Sotuv, mijozlar va menejerlar bo'yicha kengaytirilgan hisobotlar tez orada qo'shiladi."
      icon={<BarChart3 className="h-6 w-6" />}
    />
  );
}
