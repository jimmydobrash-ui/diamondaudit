interface OverallScoreProps {
  /** Slider-based overall, 0-10. */
  value: number;
  /** Styling for the number itself; the "/ 10" suffix is always muted + smaller. */
  className?: string;
}

/**
 * Renders an evaluation score with its scale, e.g. "7.5 / 10", so coaches
 * never have to ask "out of what?". All overalls in the app are the
 * slider-only average on a 0-10 scale (see lib/scoring.ts).
 */
export default function OverallScore({ value, className }: OverallScoreProps) {
  return (
    <span className={className}>
      {value}
      <span className="text-xs font-normal text-muted-foreground ml-0.5">/ 10</span>
    </span>
  );
}
