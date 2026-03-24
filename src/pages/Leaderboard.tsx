import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { mockPlayers, getOverallScore, getAgeGroup, getCategoryAverage, evaluationTemplate } from "@/lib/mock-data";
import { BarChart3, Trophy } from "lucide-react";

export default function Leaderboard() {
  const [sortBy, setSortBy] = useState<string>("overall");
  const [ageFilter, setAgeFilter] = useState<string>("all");

  const ageGroups = useMemo(() => {
    return [...new Set(mockPlayers.map(p => getAgeGroup(p.dateOfBirth)))].sort();
  }, []);

  const ranked = useMemo(() => {
    let players = [...mockPlayers];
    if (ageFilter !== "all") {
      players = players.filter(p => getAgeGroup(p.dateOfBirth) === ageFilter);
    }
    return players
      .map(p => ({
        player: p,
        overall: getOverallScore(p.id),
        categoryScores: evaluationTemplate.map(cat => ({
          category: cat.name,
          avg: getCategoryAverage(p.id, cat),
        })),
      }))
      .filter(p => p.overall > 0)
      .sort((a, b) => {
        if (sortBy === "overall") return b.overall - a.overall;
        const cat = evaluationTemplate.find(c => c.id === sortBy);
        if (!cat) return 0;
        const aScore = getCategoryAverage(a.player.id, cat) ?? 0;
        const bScore = getCategoryAverage(b.player.id, cat) ?? 0;
        return bScore - aScore;
      });
  }, [sortBy, ageFilter]);

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

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setAgeFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                ageFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
              }`}
            >
              All Ages
            </button>
            {ageGroups.map(ag => (
              <button
                key={ag}
                onClick={() => setAgeFilter(ag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  ageFilter === ag ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                }`}
              >
                {ag}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSortBy("overall")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                sortBy === "overall" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Overall
            </button>
            {evaluationTemplate.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSortBy(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  sortBy === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Rankings */}
        <div className="space-y-2">
          {ranked.map((item, i) => {
            const sortCat = evaluationTemplate.find(c => c.id === sortBy);
            const displayScore = sortBy === "overall"
              ? item.overall
              : sortCat ? getCategoryAverage(item.player.id, sortCat) ?? 0 : item.overall;

            return (
              <motion.div
                key={item.player.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/evaluate/${item.player.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    i === 0 ? "bg-primary/10" : "bg-secondary"
                  }`}>
                    {i === 0 ? (
                      <Trophy className="w-4 h-4 text-primary" />
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">#{item.player.jerseyNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">
                      {item.player.firstName} {item.player.lastName}
                    </span>
                    <div className="flex gap-3 mt-0.5">
                      {item.categoryScores.filter(c => c.avg !== null).slice(0, 3).map(c => (
                        <span key={c.category} className="text-[10px] text-muted-foreground">
                          {c.category}: <strong>{c.avg}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${i === 0 ? 'text-primary' : 'text-foreground'}`}>
                    {displayScore}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
