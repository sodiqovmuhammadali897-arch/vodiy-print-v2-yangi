import { ReactNode } from "react";
import { Loader as Loader2 } from "lucide-react";

type Props = {
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  children: ReactNode;
};

export default function AsyncState({
  loading,
  empty,
  emptyLabel = "Ma'lumot topilmadi",
  emptyDescription,
  emptyIcon,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        {emptyIcon && (
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
            {emptyIcon}
          </div>
        )}
        <div className="text-sm font-semibold text-ink-700">{emptyLabel}</div>
        {emptyDescription && (
          <div className="max-w-sm text-xs text-ink-500">{emptyDescription}</div>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
