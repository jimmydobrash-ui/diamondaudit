import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { playerAgeGroup } from "@/lib/mock-data";
import { compareForTryout } from "@/lib/rosterOrder";
import { ClipboardList, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useMyPlayerGrades, type PlayerGradeValue } from "@/hooks/usePlayerGrades";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import GradeBadge from "@/components/GradeBadge";
import OverallScore from "@/components/OverallScore";
import { calcSliderOverall, aggregateScoresByPlayer } from "@/lib/scoring";

export default function EvaluateList() {
  const hasMounted = useHasMounted();
  const { data: players = [], isLoading } = usePlayers();
  const { data: evaluations = [] } = useEvaluations();
  const { data: grades = [] } = useMyPlayerGrades();
  const { data: template } = useEvaluationTemplate();
  const categories = useMemo(() => template?.categories ?? [], [template]);

  const gradeMap = useMemo(() => {
    const m: Record<string, PlayerGradeValue> = {};
    grades.forEach(g => { m[g.player_id] = g.grade; });
    return m;
  }, [grades]);

  // Show the roster in tryout running order (age group, then jersey number)
  // so it matches who's on the field, not alphabetical.
  const orderedPlayers = useMemo(() => players.slice().sort(compareForTryout), [players]);

  const playerScores = useMemo(() => {
    const aggregates = aggregateScoresByPlayer(
      evaluations.map(ev => ({ player_id: ev.player_id, scores: ev.scores as Record<string, number> })),
    );
    const out: Record<string, number> = {};
    for (const [pid, scores] of Object.entries(aggregates)) {
      const overall = calcSliderOverall(scores, categories);
      if (overall > 0) out[pid] = overall;
    }
    return out;
  }, [evaluations, categories]);

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Evaluate</h1>
          </div>
          <p className="text-sm text-muted-foreground">Tap a player to start scoring</p>
        </motion.div>

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
            ))
          ) : orderedPlayers.map((player, i) => {
            const score = playerScores[player.id];
            return (
              <motion.div key={player.id} initial={hasMounted.current ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={hasMounted.current ? undefined : { delay: i * 0.03 }}>
                <Link to={`/evaluate/${player.id}`} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-foreground">#{player.jersey_number ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{player.first_name} {player.last_name}</span>
                      {gradeMap[player.id] && <GradeBadge grade={gradeMap[player.id]} />}
                      {player.tags.includes("Top Prospect") && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">TOP</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{playerAgeGroup(player)} · {player.positions.join(", ")} · B:{player.bats} T:{player.throws}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {score && <OverallScore value={score} showTier className={`text-lg font-bold ${score >= 8 ? "text-primary" : "text-foreground"}`} />}
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {!isLoading && players.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <p>No players to evaluate. Add players first.</p>
              <Link to="/players/add" className="inline-block mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Add Players</Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
