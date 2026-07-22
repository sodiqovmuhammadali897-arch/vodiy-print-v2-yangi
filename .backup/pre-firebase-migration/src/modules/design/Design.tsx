import { Palette } from "lucide-react";
import PlaceholderModule from "../../components/ui/PlaceholderModule";

export default function Design() {
  return (
    <PlaceholderModule
      title="Dizayn paneli"
      description="Original fayllar, preview, versiyalar, tasdiqlash va izohlar uchun alohida ish maydoni tez orada qo'shiladi."
      icon={<Palette className="h-6 w-6" />}
    />
  );
}
