import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { getAgeGroup, evaluationTemplate } from "@/lib/mock-data";
import { Users, ClipboardList, BarChart3, TrendingUp } from "lucide-react";

function calcOverall(scores: Record<string, number>): number {
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export default function Index() {
  const { data: players = [] } = usePlayers();
  const { data: evaluations = [] } = useEvaluations();

  const playerScores = useMemo(() => {
    const map: Record<string, number[]> = {};
    evaluations.forEach(ev => {
      const scores = ev.scores as Record<string, number>;
      const avg = calcOverall(scores);
      if (avg > 0) {
        if (!map[ev.player_id]) map[ev.player_id] = [];
        map[ev.player_id].push(avg);
      }
    });
    return Object.fromEntries(
      Object.entries(map).map(([id, vals]) => [id, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10])
    );
  }, [evaluations]);

  const evaluatedCount = Object.keys(playerScores).length;
  const allScores = Object.values(playerScores);
  const avgScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : "—";
  const topScore = allScores.length ? Math.max(...allScores).toFixed(1) : "—";

  const stats = [
    { label: "Players", value: players.length, icon: Users },
    { label: "Evaluated", value: evaluatedCount, icon: ClipboardList },
    { label: "Avg Score", value: avgScore, icon: BarChart3 },
    { label: "Top Score", value: topScore, icon: TrendingUp },
  ];

  const topPlayers = useMemo(() => {
    return players
      .filter(p => playerScores[p.id])
      .sort((a, b) => (playerScores[b.id] ?? 0) - (playerScores[a.id] ?? 0))
      .slice(0, 5);
  }, [players, playerScores]);

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Tryout Overview</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }} className="p-4 rounded-xl bg-card card-elevated">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/players" className="p-4 rounded-xl bg-primary text-primary-foreground card-elevated flex flex-col gap-1">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold mt-1">View Players</span>
            <span className="text-xs opacity-80">Browse roster</span>
          </Link>
          <Link to="/evaluate" className="p-4 rounded-xl bg-foreground text-background card-elevated flex flex-col gap-1">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-semibold mt-1">Start Evaluating</span>
            <span className="text-xs opacity-80">Score players</span>
          </Link>
        </div>

        {topPlayers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Top Players</h2>
              <Link to="/leaderboard" className="text-xs text-primary font-medium">View All</Link>
            </div>
            <div className="space-y-2">
              {topPlayers.map((player, i) => (
                <motion.div key={player.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                  <Link to={`/evaluate/${player.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                      <span className="text-sm font-bold">#{player.jersey_number ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate block">{player.first_name} {player.last_name}</span>
                      <span className="text-xs text-muted-foreground">{getAgeGroup(player.date_of_birth)} · {player.positions.join(", ")}</span>
                    </div>
                    <span className="text-lg font-bold text-primary">{playerScores[player.id]}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground text-sm">No players yet. Add your roster to get started.</p>
            <div className="flex gap-2 justify-center">
              <Link to="/players/add" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Add Player</Link>
              <Link to="/players/import" className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium">Import CSV</Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
