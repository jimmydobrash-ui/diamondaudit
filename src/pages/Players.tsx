import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { getAgeGroup } from "@/lib/mock-data";
import { calcSliderOverall, aggregateScoresByPlayer } from "@/lib/scoring";
import { useAuth } from "@/hooks/useAuth";
import OverallScore from "@/components/OverallScore";
import { Search, Plus, Upload, ChevronRight } from "lucide-react";

export default function Players() {
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const { role } = useAuth();
  const { data: players = [], isLoading } = usePlayers();
  const { data: evaluations = [] } = useEvaluations();
  const { data: template } = useEvaluationTemplate();
  const categories = useMemo(() => template?.categories ?? [], [template]);

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

  const ageGroups = useMemo(() => {
    return [...new Set(players.map(p => getAgeGroup(p.date_of_birth)))].sort();
  }, [players]);

  const filtered = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = search === "" ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.jersey_number?.toString() ?? "").includes(search);
      const matchesAge = ageFilter === "all" || getAgeGroup(p.date_of_birth) === ageFilter;
      return matchesSearch && matchesAge;
    });
  }, [players, search, ageFilter]);

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Players</h1>
              <p className="text-sm text-muted-foreground mt-1">{players.length} players registered</p>
            </div>
            {role === "admin" && (
              <div className="flex gap-2">
                <Link to="/players/import" className="h-9 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Import
                </Link>
                <Link to="/players/add" className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name or jersey #" value={search} onChange={e => setSearch(e.target.value)} className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {ageGroups.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setAgeFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>All Ages</button>
            {ageGroups.map(ag => (
              <button key={ag} onClick={() => setAgeFilter(ag)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === ag ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{ag}</button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />
            ))
          ) : filtered.map((player, i) => {
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
                      {player.tags.includes("Top Prospect") && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">TOP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{getAgeGroup(player.date_of_birth)}</span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground">{player.positions.join(", ")}</span>
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="text-xs text-muted-foreground">B:{player.bats} T:{player.throws}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {score && <OverallScore value={score} className={`text-lg font-bold ${score >= 8 ? "text-primary" : "text-foreground"}`} />}
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {players.length === 0 ? (
                <div className="space-y-3">
                  <p>No players yet</p>
                  <div className="flex gap-2 justify-center">
                    <Link to="/players/add" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Add Player</Link>
                    <Link to="/players/import" className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium">Import CSV</Link>
                  </div>
                </div>
              ) : "No players found"}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
