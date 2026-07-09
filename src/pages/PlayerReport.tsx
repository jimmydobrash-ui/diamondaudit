import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import ReportCardDocument from "@/components/ReportCardDocument";
import { playerAgeGroup } from "@/lib/mock-data";
import { aggregateScoresByPlayer, visibleEvalCategories } from "@/lib/scoring";
import { buildPlayerReport, peerValuesForGroup } from "@/lib/reportCard";
import { ArrowLeft, Printer } from "lucide-react";

type Scores = Record<string, number>;

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

  const evalCount = useMemo(
    () => evaluations.filter(e => e.player_id === playerId).length,
    [evaluations, playerId],
  );

  // Aggregate every player once (cross-coach roll-up) so this player's numbers
  // and the age-group peer distribution for percentiles both come from the same
  // source the rest of the app uses.
  const allAggregates = useMemo(
    () => aggregateScoresByPlayer(evaluations.map(e => ({ player_id: e.player_id, scores: e.scores as Scores }))),
    [evaluations],
  );

  const report = useMemo(() => {
    if (!player) return null;
    const peers = peerValuesForGroup(playerAgeGroup(player), players, allAggregates);
    return buildPlayerReport(allAggregates[player.id] ?? {}, peers, categories, visibleCategories);
  }, [player, players, allAggregates, categories, visibleCategories]);

  const isLoading = playersLoading || evalsLoading;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Player not found
      </div>
    );
  }

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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <ReportCardDocument player={player} report={report} evalCount={evalCount} today={today} />
        </motion.div>
      </main>
    </div>
  );
}
