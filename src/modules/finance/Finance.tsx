import { Wallet } from "lucide-react";
import PlaceholderModule from "../../components/ui/PlaceholderModule";

export default function Finance() {
  return (
    <PlaceholderModule
      title="Moliya"
      description="Kirim-chiqim, qarzdorlik va moliyaviy hisobotlar moduli tez orada qo'shiladi."
      icon={<Wallet className="h-6 w-6" />}
    />
  );
}
