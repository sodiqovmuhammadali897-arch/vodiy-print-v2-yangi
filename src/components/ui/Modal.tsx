import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${sizeMap[size]} animate-fade-in overflow-hidden rounded-2xl bg-white shadow-pop`}
      >
        <div className="flex items-start justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-sm text-ink-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
