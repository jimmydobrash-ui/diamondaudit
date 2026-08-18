import ScoreRing from "@/components/ScoreRing";
import { playerAgeGroup } from "@/lib/mock-data";
import type { ScoreTier } from "@/lib/scoring";
import type { ReportData, ReportCardPlayer } from "@/lib/reportCard";

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

// Same semantic language as the evaluate-screen ScoringRuler, keyed on the tier
// label so it stays correct if SCORE_TIERS is reordered.
const TIER_STYLE: Record<string, { badge: string; ring: string }> = {
  "Unicorn": { badge: "bg-primary/10 text-primary", ring: "text-primary" },
  "Elite": { badge: "bg-primary/10 text-primary", ring: "text-primary" },
  "Above Average": { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", ring: "text-emerald-500" },
  "Average": { badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400", ring: "text-blue-500" },
  "Below Average": { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400", ring: "text-amber-500" },
  "Needs significant work": { badge: "bg-muted text-muted-foreground", ring: "text-muted-foreground" },
};
const FALLBACK_TIER_STYLE = { badge: "bg-secondary text-muted-foreground", ring: "text-muted-foreground" };

function TierBadge({ tier, size = "md" }: { tier: ScoreTier | null; size?: "sm" | "md" | "lg" }) {
  if (!tier) return <span className="text-xs text-muted-foreground">Not yet evaluated</span>;
  const style = TIER_STYLE[tier.label] ?? FALLBACK_TIER_STYLE;
  const sizeClass = size === "lg" ? "text-base px-3.5 py-1.5" : size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${style.badge} ${sizeClass}`}>
      {tier.label} ({tier.league})
    </span>
  );
}

/**
 * The printable body of a player's report card — masthead through footer, with
 * no page chrome. Shared by the single report page (/players/:id/report) and
 * the bulk PDF export, so both render identically.
 */
export default function ReportCardDocument({
  player,
  report,
  evalCount,
  today,
}: {
  player: ReportCardPlayer;
  report: ReportData;
  evalCount: number;
  today: string;
}) {
  const overallStyle = report.overallTier ? (TIER_STYLE[report.overallTier.label] ?? FALLBACK_TIER_STYLE) : FALLBACK_TIER_STYLE;
  const hasStandings = report.categories.some(c => c.measurables.some(m => m.standing));

  return (
    <div className="space-y-6">
      {/* Masthead */}
      <div className="text-center space-y-1">
        <img src="/logo-256.png" alt="DiamondAudit" className="h-10 w-auto mx-auto mb-2" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tryout Evaluation Report
        </p>
      </div>

      {/* Player identity */}
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">{player.first_name} {player.last_name}</h1>
        <p className="text-sm text-muted-foreground">
          {player.jersey_number != null && <>#{player.jersey_number} · </>}
          {playerAgeGroup(player)}
          {player.positions.length > 0 && <> · {player.positions.join(", ")}</>}
          {" "}· B:{player.bats} T:{player.throws}
        </p>
      </div>

      {evalCount === 0 ? (
        <div className="bg-card rounded-2xl p-8 card-elevated text-center text-sm text-muted-foreground">
          Not evaluated yet.
        </div>
      ) : (
        <>
          {/* Headline overall */}
          <div className="bg-card rounded-2xl p-8 card-elevated flex flex-col items-center gap-3 print:shadow-none print:border">
            <ScoreRing value={report.overall} colorClassName={overallStyle.ring}>
              <div className="text-center leading-tight">
                <div className="text-2xl font-bold text-foreground tabular-nums">{report.overall}</div>
                <div className="text-[10px] text-muted-foreground">/ 10</div>
              </div>
            </ScoreRing>
            <TierBadge tier={report.overallTier} size="lg" />
            <p className="text-xs text-muted-foreground">
              Overall evaluation · {evalCount} {evalCount === 1 ? "coach" : "coaches"}
            </p>
          </div>

          {/* Category breakdown */}
          <div className="space-y-3">
            {report.categories.map(cat => (
              <div key={cat.name} className="bg-card rounded-xl p-4 card-elevated print:shadow-none print:border">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h2 className="text-sm font-semibold text-foreground">{cat.name}</h2>
                  {cat.hasSliderSkills && <TierBadge tier={cat.tier} />}
                </div>
                {cat.measurables.length > 0 && (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2.5 ${cat.hasSliderSkills ? "mt-2.5 border-t border-border/60" : ""}`}>
                    {cat.measurables.map(m => (
                      <div key={m.id} className="bg-secondary/60 rounded-lg px-3.5 py-3">
                        {/* leading-[15px] gives the 11px label room to breathe —
                            the previous text-[10px] + truncate combo produced a
                            line box tighter than the font's ascent, so html2canvas
                            rasterized it with the tops of the letters sliced off. */}
                        <div className="text-[11px] font-semibold text-muted-foreground leading-[15px]">{m.label}</div>
                        <div className="text-lg font-bold text-foreground tabular-nums leading-6 mt-0.5">
                          {m.value} <span className="text-[11px] font-medium text-muted-foreground">{m.unit}</span>
                        </div>
                        {m.standing && (
                          <div className="mt-2">
                            <div className="h-1.5 rounded-full bg-border/70 overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${m.standing.percentile}%` }} />
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1.5 leading-[15px] tabular-nums">
                              <span className="font-semibold text-foreground">{ordinal(m.standing.rank)}</span> of {m.standing.total}
                              {" · "}{ordinal(m.standing.percentile)} pct
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Coach notes — only present when the caller explicitly opted in
              (the internal season archive); the family-facing single report
              and regular bulk export never populate report.notes. */}
          {report.notes && report.notes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground px-1">Coach Notes</h2>
              {report.notes.map((note, i) => (
                <div key={i} className="bg-card rounded-xl p-4 card-elevated print:shadow-none print:border">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">{note.coachName}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="text-center pt-2 space-y-0.5">
        {hasStandings && (
          <p className="text-[11px] text-muted-foreground mb-2 max-w-md mx-auto">
            Rank and percentile compare {player.first_name} against the {playerAgeGroup(player)} athletes
            measured on each drill at this tryout.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">Report generated {today}</p>
        <p className="text-[11px] text-muted-foreground">DiamondAudit · diamondaudit.io</p>
      </div>
    </div>
  );
}
