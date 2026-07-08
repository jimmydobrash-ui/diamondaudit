import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import ScoreRing from "@/components/ScoreRing";
import { playerAgeGroup } from "@/lib/mock-data";
import {
  aggregateScoresByPlayer,
  calcSliderOverall,
  calcCategoryAvg,
  categoryMeasurables,
  visibleEvalCategories,
  scoreTier,
  type ScoreTier,
} from "@/lib/scoring";
import { ArrowLeft, Printer } from "lucide-react";

type Scores = Record<string, number>;

// Same semantic language as the evaluate-screen ScoringRuler, so a tier reads
// the same color everywhere in the app. Keyed on the tier label rather than
// the numeric threshold so it stays correct if SCORE_TIERS is ever reordered.
const TIER_STYLE: Record<string, { badge: string; ring: string }> = {
  "Unicorn": { badge: "bg-primary/10 text-primary", ring: "text-primary" },
  "Elite": { badge: "bg-primary/10 text-primary", ring: "text-primary" },
  "Above Average": { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", ring: "text-emerald-500" },
  "Average": { badge: "bg-secondary text-foreground", ring: "text-muted-foreground" },
  "Below Average": { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400", ring: "text-amber-500" },
  "Needs significant work": { badge: "bg-muted text-muted-foreground", ring: "text-muted-foreground" },
};
const FALLBACK_TIER_STYLE = { badge: "bg-secondary text-muted-foreground", ring: "text-muted-foreground" };

function TierBadge({ tier, size = "md" }: { tier: ScoreTier | null; size?: "sm" | "md" | "lg" }) {
  if (!tier) {
    return <span className="text-xs text-muted-foreground">Not yet evaluated</span>;
  }
  const style = TIER_STYLE[tier.label] ?? FALLBACK_TIER_STYLE;
  const sizeClass = size === "lg" ? "text-base px-3.5 py-1.5" : size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${style.badge} ${sizeClass}`}>
      {tier.label} ({tier.league})
    </span>
  );
}

export default function PlayerReport() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: evaluations = [], isLoading: evalsLoading } = useEvaluations();
  const { data: template } = useEvaluationTemplate();

  const player = players.find(p => p.id === playerId);
  const categories = useMemo(() => template?.categories ?? [], [template]);
  const visibleCategories = useMemo(
    () => visibleEvalCategories(categories, player?.positions),
    [categories, player?.positions],
  );

  const playerEvals = useMemo(
    () => evaluations.filter(e => e.player_id === playerId),
    [evaluations, playerId],
  );

  // Same cross-coach roll-up used everywhere else (leaderboard, player detail),
  // so this report's numbers always match what coaches see in the app.
  const report = useMemo(() => {
    const agg: Scores = aggregateScoresByPlayer(
      playerEvals.map(e => ({ player_id: e.player_id, scores: e.scores as Scores })),
    )[playerId ?? ""] ?? {};
    const overall = calcSliderOverall(agg, categories);
    return {
      overall,
      overallTier: scoreTier(overall),
      categories: visibleCategories
        .map(cat => {
          // A category made up entirely of number-type skills (e.g. Running,
          // scored purely on sprint times) has no slider average and therefore
          // no tier — calcCategoryAvg only averages slider skills. Track that
          // so the UI shows raw measurables without a misleading "not yet
          // evaluated" tier badge next to real data.
          const hasSliderSkills = cat.skills.some(s => s.type === "slider");
          const avg = hasSliderSkills ? calcCategoryAvg(agg, cat) : null;
          return {
            name: cat.name,
            hasSliderSkills,
            avg,
            tier: avg !== null ? scoreTier(avg) : null,
            measurables: categoryMeasurables(agg, cat),
          };
        })
        .filter(c => c.avg !== null || c.measurables.length > 0),
    };
  }, [playerEvals, playerId, categories, visibleCategories]);

  const isLoading = playersLoading || evalsLoading;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Player not found
      </div>
    );
  }

  const overallStyle = report.overallTier ? (TIER_STYLE[report.overallTier.label] ?? FALLBACK_TIER_STYLE) : FALLBACK_TIER_STYLE;

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal chrome, not the full app shell — this surface is meant to be
          shared/printed, so it skips the nav/org-switcher/sign-out clutter. */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg border-b print:hidden">
        <div className="container flex items-center justify-between h-14">
          <button
            onClick={() => navigate(`/players/${playerId}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => window.print()}
            className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
        </div>
      </header>

      <main className="container max-w-2xl py-8 print:py-0 print:max-w-none">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Masthead */}
          <div className="text-center space-y-1 print:pt-6">
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

          {playerEvals.length === 0 ? (
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
                  Overall evaluation · {playerEvals.length} {playerEvals.length === 1 ? "coach" : "coaches"}
                </p>
              </div>

              {/* Category breakdown */}
              <div className="space-y-3">
                {report.categories.map(cat => (
                  <div key={cat.name} className="bg-card rounded-xl p-4 card-elevated print:shadow-none print:border">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h2 className="text-sm font-semibold text-foreground">{cat.name}</h2>
                      {/* Measurable-only categories (e.g. Running, scored purely
                          on sprint times) have no slider tier to show. */}
                      {cat.hasSliderSkills && <TierBadge tier={cat.tier} />}
                    </div>
                    {cat.measurables.length > 0 && (
                      <div className={`flex flex-wrap gap-2 pt-2.5 ${cat.hasSliderSkills ? "mt-2.5 border-t border-border/60" : ""}`}>
                        {cat.measurables.map(m => (
                          <div key={m.id} className="bg-secondary/60 rounded-lg px-3 py-1.5 min-w-[92px]">
                            <div className="text-sm font-bold text-foreground tabular-nums">
                              {m.value} <span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="text-center pt-2 pb-6 space-y-0.5 print:pt-8">
            <p className="text-[11px] text-muted-foreground">Report generated {today}</p>
            <p className="text-[11px] text-muted-foreground">DiamondAudit · diamondaudit.io</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
