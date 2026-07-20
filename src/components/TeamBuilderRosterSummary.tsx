import { Download, Minus, Plus } from "lucide-react";
import { computeRosterMath, type PositionCount } from "./TeamBuilderMath";

interface TeamBuilderRosterSummaryProps {
  /** The selected age group, or "all". Roster math only shows for a specific group. */
  ageGroup: string;
  offeredCount: number;
  bubbleCount: number;
  /** Roster-size target for this age group (ignored when ageGroup is "all"). */
  target: number;
  onTargetChange: (next: number) => void;
  /** Position coverage among the offered players in the current scope. */
  positions: PositionCount[];
  onExport: () => void;
}

/**
 * The roster-construction header for Team Builder: how many offers are in vs. the
 * coach's roster-size target, how many spots stay open, who's on the bubble, a
 * position-coverage sanity check, and a one-tap CSV export of the offer list.
 * Purely presentational — all counts and math are handed in by the page.
 */
export default function TeamBuilderRosterSummary({
  ageGroup,
  offeredCount,
  bubbleCount,
  target,
  onTargetChange,
  positions,
  onExport,
}: TeamBuilderRosterSummaryProps) {
  const scoped = ageGroup !== "all";
  const math = computeRosterMath(offeredCount, bubbleCount, target);

  return (
    <div className="bg-card rounded-xl p-4 card-elevated space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {scoped ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground tabular-nums">{math.offered}</span>
                <span className="text-sm text-muted-foreground">
                  / {math.target} spot{math.target === 1 ? "" : "s"} offered
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {math.open > 0
                  ? `${math.open} open`
                  : math.over > 0
                    ? `${math.over} over roster`
                    : "roster full"}
                {" · "}
                {math.bubble} on the bubble
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground tabular-nums">{offeredCount}</span>
                <span className="text-sm text-muted-foreground">offer{offeredCount === 1 ? "" : "s"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {bubbleCount} on the bubble · all age groups
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={offeredCount === 0}
          className="h-9 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 flex-shrink-0 hover:bg-secondary/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {scoped && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Roster size</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTargetChange(target - 1)}
              disabled={target <= 1}
              aria-label="Decrease roster size"
              className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold text-foreground tabular-nums">{target}</span>
            <button
              type="button"
              onClick={() => onTargetChange(target + 1)}
              aria-label="Increase roster size"
              className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/70 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {positions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Offered positions:</span>{" "}
          {positions.map(pc => `${pc.position}×${pc.count}`).join(" · ")}
        </div>
      )}
    </div>
  );
}
