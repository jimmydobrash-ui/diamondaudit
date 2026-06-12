import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { getAgeGroup } from "@/lib/mock-data";
import { calcSliderOverall, calcCategoryAvg, aggregateScoresByPlayer, scoreTier } from "@/lib/scoring";
import { toCsv, downloadCsv } from "@/lib/csv";
import OverallScore from "@/components/OverallScore";
import { BarChart3, Trophy, Download } from "lucide-react";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState("overall");
  const [ageFilter, setAgeFilter] = useState("all");
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: evaluations = [], isLoading: evalsLoading } = useEvaluations();
  const isLoading = playersLoading || evalsLoading;
  const { data: template } = useEvaluationTemplate();

  const categories = useMemo(() => template?.categories ?? [], [template]);

  const playerAggregates = useMemo(
    () => aggregateScoresByPlayer(evaluations.map(ev => ({ player_id: ev.player_id, scores: ev.scores as Record<string, number> }))),
    [evaluations],
  );

  const ageGroups = useMemo(() => {
    return [...new Set(players.map(p => getAgeGroup(p.date_of_birth)))].sort();
  }, [players]);

  const evalCounts = useMemo(() => {
    const m: Record<string, number> = {};
    evaluations.forEach(e => { m[e.player_id] = (m[e.player_id] ?? 0) + 1; });
    return m;
  }, [evaluations]);

  const ranked = useMemo(() => {
    let list = [...players];
    if (ageFilter !== "all") list = list.filter(p => getAgeGroup(p.date_of_birth) === ageFilter);

    return list
      .map(p => {
        const scores = playerAggregates[p.id] ?? {};
        return {
          player: p,
          overall: calcSliderOverall(scores, categories),
          scores,
          categoryScores: categories.map(cat => ({ category: cat.name, id: cat.id, avg: calcCategoryAvg(scores, cat) })),
        };
      })
      .filter(p => p.overall > 0)
      .sort((a, b) => {
        if (sortBy === "overall") return b.overall - a.overall;
        const cat = categories.find(c => c.id === sortBy);
        if (!cat) return 0;
        const aScore = calcCategoryAvg(a.scores, cat) ?? 0;
        const bScore = calcCategoryAvg(b.scores, cat) ?? 0;
        return bScore - aScore;
      });
  }, [players, playerAggregates, sortBy, ageFilter, categories]);

  const handleExport = () => {
    const headers = [
      "Rank", "Jersey", "First Name", "Last Name", "Age Group", "Positions",
      "Bats", "Throws", "Overall", "Tier",
      ...categories.map(c => c.name),
      "Evaluations",
    ];
    const rows = ranked.map((item, i) => {
      const p = item.player;
      const catVals = categories.map(c => item.categoryScores.find(cs => cs.id === c.id)?.avg ?? "");
      return [
        i + 1,
        p.jersey_number ?? "",
        p.first_name,
        p.last_name,
        getAgeGroup(p.date_of_birth),
        p.positions.join(" / "),
        p.bats,
        p.throws,
        item.overall,
        scoreTier(item.overall)?.label ?? "",
        ...catVals,
        evalCounts[p.id] ?? 0,
      ];
    });
    const scope = ageFilter === "all" ? "all" : ageFilter;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`diamondaudit-leaderboard-${scope}-${date}.csv`, toCsv(headers, rows));
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Leaderboard</h1>
            </div>
            <p className="text-sm text-muted-foreground">Rankings by evaluation scores</p>
          </div>
          {ranked.length > 0 && (
            <button
              onClick={handleExport}
              className="h-9 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 flex-shrink-0 hover:bg-secondary/70 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
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
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSortBy(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${sortBy === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{cat.name}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
            ))}
          {!isLoading && ranked.map((item, i) => {
            const cat = categories.find(c => c.id === sortBy);
            const displayScore = sortBy === "overall" ? item.overall : (cat ? calcCategoryAvg(item.scores, cat) ?? 0 : 0);
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
                  <OverallScore value={displayScore} showTier className={`text-lg font-bold ${i === 0 ? "text-primary" : "text-foreground"}`} />
                </Link>
              </motion.div>
            );
          })}
          {!isLoading && ranked.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No evaluations yet</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
