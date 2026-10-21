import { useEffect, useRef, useState, type ReactNode } from "react";
import { COUNT_UP_MS, easeOutCubic, formatTemplate, parseNumberTemplate, prefersReducedMotion, sameShape, type NumberTemplate } from "../../lib/countUp";

// A stat value that counts up to its number: "0.0 mln" → "52.3 mln" over a
// second, easing out. A new value of the same shape runs on from the number
// on screen; anything that isn't a plain number is shown as it is.
export default function AnimatedNumber({ value }: { value: ReactNode }) {
  const target = parseNumberTemplate(value);
  const [shown, setShown] = useState<string | null>(() => (target && !prefersReducedMotion() ? formatTemplate(target, 0) : null));
  const current = useRef<{ t: NumberTemplate; at: number } | null>(null);
  const key = target ? formatTemplate(target, target.value) : null;

  useEffect(() => {
    if (!target) {
      current.current = null;
      setShown(null);
      return;
    }
    if (prefersReducedMotion()) {
      current.current = { t: target, at: target.value };
      setShown(null);
      return;
    }
    const from = current.current && sameShape(current.current.t, target) ? current.current.at : 0;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_UP_MS);
      const at = from + (target.value - from) * easeOutCubic(k);
      current.current = { t: target, at };
      setShown(k < 1 ? formatTemplate(target, at) : null);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Re-run only when the value itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <>{shown ?? value}</>;
}
