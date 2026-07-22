import { ReactNode } from "react";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export default function PlaceholderModule({ title, description, icon }: Props) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        {icon || <Construction className="h-6 w-6" />}
      </div>
      <h1 className="font-display text-2xl font-bold text-ink-900">{title}</h1>
      <p className="max-w-md text-sm text-ink-500">{description}</p>
      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Ishlab chiqilmoqda
      </div>
    </div>
  );
}
