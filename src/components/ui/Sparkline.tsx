type Props = {
  data: number[];
  color?: string;
  height?: number;
};

// A minimal trend line for stat cards — not an axis-labeled chart, just a
// "is this going up or down" glance. Renders nothing meaningful for <2
// points, which callers should treat as "don't render".
export default function Sparkline({ data, color = "#4f46e5", height = 32 }: Props) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const width = 100;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / span) * height}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
