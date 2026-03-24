import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { getAgeGroup, evaluationTemplate } from "@/lib/mock-data";
import { BarChart3, Trophy } from "lucide-react";

function calcOverall(scores: Record<string, number>): number {
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function calcCategoryAvg(scores: Record<string, number>, categoryId: string): number | null {
  const cat = evaluationTemplate.find(c => c.id === categoryId);
  if (!cat) return null;
  const vals = cat.skills.map(s => scores[s.id]).filter((v): v is number => v !== undefined);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState("overall");
  const [ageFilter, setAgeFilter] = useState("all");
  const { data: players = [] } = usePlayers();
  const { data: evaluations = [] } = useEvaluations();

  // Aggregate scores across all coaches per player
  const playerAggregates = useMemo(() => {
    const map: Record<string, Record<string, number[]>> = {};
    evaluations.forEach(ev => {
      const scores = ev.scores as Record<string, number>;
      if (!map[ev.player_id]) map[ev.player_id] = {};
      Object.entries(scores).forEach(([key, val]) => {
        if (!map[ev.player_id][key]) map[ev.player_id][key] = [];
        map[ev.player_id][key].push(val);
      });
    });
    // Average each skill across coaches
    return Object.fromEntries(
      Object.entries(map).map(([pid, skills]) => [
        pid,
        Object.fromEntries(Object.entries(skills).map(([k, vals]) => [k, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10]))
      ])
    );
  }, [evaluations]);

  const ageGroups = useMemo(() => {
    return [...new Set(players.map(p => getAgeGroup(p.date_of_birth)))].sort();
  }, [players]);

  const ranked = useMemo(() => {
    let list = [...players];
    if (ageFilter !== "all") list = list.filter(p => getAgeGroup(p.date_of_birth) === ageFilter);

    return list
      .map(p => {
        const scores = playerAggregates[p.id] ?? {};
        return {
          player: p,
          overall: calcOverall(scores),
          scores,
          categoryScores: evaluationTemplate.map(cat => ({ category: cat.name, id: cat.id, avg: calcCategoryAvg(scores, cat.id) })),
        };
      })
      .filter(p => p.overall > 0)
      .sort((a, b) => {
        if (sortBy === "overall") return b.overall - a.overall;
        const aScore = calcCategoryAvg(a.scores, sortBy) ?? 0;
        const bScore = calcCategoryAvg(b.scores, sortBy) ?? 0;
        return bScore - aScore;
      });
  }, [players, playerAggregates, sortBy, ageFilter]);

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Leaderboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Rankings by evaluation scores</p>
        </motion.div>

        <div className="space-y-2">
          {ageGroups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setAgeFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>All Ages</button>
              {ageGroups.map(ag => (
                <button key={ag} onClick={() => setAgeFilter(ag)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === ag ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{ag}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setSortBy("overall")} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${sortBy === "overall" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Overall</button>
            {evaluationTemplate.map(cat => (
              <button key={cat.id} onClick={() => setSortBy(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${sortBy === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{cat.name}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {ranked.map((item, i) => {
            const displayScore = sortBy === "overall" ? item.overall : (calcCategoryAvg(item.scores, sortBy) ?? 0);
            return (
              <motion.div key={item.player.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/evaluate/${item.player.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${i === 0 ? "bg-primary/10" : "bg-secondary"}`}>
                    {i === 0 ? <Trophy className="w-4 h-4 text-primary" /> : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">#{item.player.jersey_number ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">{item.player.first_name} {item.player.last_name}</span>
                    <div className="flex gap-3 mt-0.5">
                      {item.categoryScores.filter(c => c.avg !== null).slice(0, 3).map(c => (
                        <span key={c.category} className="text-[10px] text-muted-foreground">{c.category}: <strong>{c.avg}</strong></span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${i === 0 ? "text-primary" : "text-foreground"}`}>{displayScore}</span>
                </Link>
              </motion.div>
            );
          })}
          {ranked.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No evaluations yet</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
