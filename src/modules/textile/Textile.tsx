import { Shirt } from "lucide-react";
import PlaceholderModule from "../../components/ui/PlaceholderModule";

export default function Textile() {
  return (
    <PlaceholderModule
      title="Textil"
      description="Textil mahsulotlar, buyurtmalar va ishlab chiqarish jarayonlari uchun modul tez orada tayyor bo'ladi."
      icon={<Shirt className="h-6 w-6" />}
    />
  );
}
