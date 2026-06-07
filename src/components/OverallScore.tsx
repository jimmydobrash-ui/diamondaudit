import { scoreTier } from "@/lib/scoring";

interface OverallScoreProps {
  /** Slider-based overall, 0-10. */
  value: number;
  /** Styling for the number itself; the "/ 10" suffix is always muted + smaller. */
  className?: string;
  /** When true, show the rubric tier (e.g. "Average (AAA)") under the number. */
  showTier?: boolean;
}

/**
 * Renders an evaluation score with its scale, e.g. "7.5 / 10", so coaches
 * never have to ask "out of what?". All overalls in the app are the
 * slider-only average on a 0-10 scale (see lib/scoring.ts). With showTier, it
 * also labels the rubric tier so coaches know what the number means at a glance.
 */
export default function OverallScore({ value, className, showTier = false }: OverallScoreProps) {
  const tier = showTier ? scoreTier(value) : null;

  const number = (
    <span className={className}>
      {value}
      <span className="text-xs font-normal text-muted-foreground ml-0.5">/ 10</span>
    </span>
  );

  if (!tier) return number;

  return (
    <span className="inline-flex flex-col items-end leading-tight">
      {number}
      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{tier.badge}</span>
    </span>
  );
}
