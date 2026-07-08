interface ScoreRingProps {
  /** 0-10, same scale as every overall/category score in the app. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Tailwind text-color class for the progress arc (uses currentColor). */
  colorClassName?: string;
  /** Tailwind text-color class for the background track. */
  trackClassName?: string;
  children?: React.ReactNode;
}

/**
 * A circular progress ring for a 0-10 score, with centered content (e.g. a
 * tier badge). Pure SVG/CSS — no charting dependency. Used on the player
 * report card as the headline visual; generic enough to reuse elsewhere.
 */
export default function ScoreRing({
  value,
  size = 132,
  strokeWidth = 10,
  colorClassName = "text-primary",
  trackClassName = "text-secondary",
  children,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(10, value)) / 10;
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="presentation">
        <circle
          cx={center} cy={center} r={radius} fill="none"
          strokeWidth={strokeWidth} className={trackClassName} stroke="currentColor" opacity={0.4}
        />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          strokeWidth={strokeWidth} className={colorClassName} stroke="currentColor"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
