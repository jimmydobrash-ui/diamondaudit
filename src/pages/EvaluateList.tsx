import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { getAgeGroup } from "@/lib/mock-data";
import { ClipboardList, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useMyPlayerGrades } from "@/hooks/usePlayerGrades";
import GradeBadge from "@/components/GradeBadge";
import { calcFlatOverall } from "@/lib/scoring";

export default function EvaluateList() {
  const { data: players = [], isLoading } = usePlayers();
  const { data: evaluations = [] } = useEvaluations();
  const { data: grades = [] } = useMyPlayerGrades();

  const gradeMap = useMemo(() => {
    const m: Record<string, string> = {};
    grades.forEach(g => { m[g.player_id] = g.grade; });
    return m;
  }, [grades]);

  const playerScores = useMemo(() => {
    const map: Record<string, number[]> = {};
    evaluations.forEach(ev => {
      const avg = calcFlatOverall(ev.scores as Record<string, number>);
      if (avg > 0) {
        if (!map[ev.player_id]) map[ev.player_id] = [];
        map[ev.player_id].push(avg);
      }
    });
    return Object.fromEntries(
      Object.entries(map).map(([id, vals]) => [id, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10])
    );
  }, [evaluations]);

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
          ) : players.map((player, i) => {
            const score = playerScores[player.id];
            return (
              <motion.div key={player.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/evaluate/${player.id}`} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-foreground">#{player.jersey_number ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{player.first_name} {player.last_name}</span>
                      {gradeMap[player.id] && <GradeBadge grade={gradeMap[player.id] as any} />}
                      {player.tags.includes("Top Prospect") && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">TOP</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{getAgeGroup(player.date_of_birth)} · {player.positions.join(", ")} · B:{player.bats} T:{player.throws}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {score && <span className={`text-lg font-bold ${score >= 8 ? "text-primary" : "text-foreground"}`}>{score}</span>}
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
