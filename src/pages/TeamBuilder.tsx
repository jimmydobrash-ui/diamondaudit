import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import GradeBadge from "@/components/GradeBadge";
import { usePlayers } from "@/hooks/usePlayers";
import { useMyPlayerGrades, useSetPlayerGrade, type PlayerGradeValue } from "@/hooks/usePlayerGrades";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { getAgeGroup } from "@/lib/mock-data";
import { calcSliderOverall, aggregateScoresByPlayer } from "@/lib/scoring";
import OverallScore from "@/components/OverallScore";
import { Layers, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

const COLUMNS: { key: PlayerGradeValue; label: string; color: string }[] = [
  { key: "offer", label: "Offer", color: "border-emerald-500/40" },
  { key: "bubble", label: "Bubble", color: "border-amber-500/40" },
  { key: "pass", label: "Pass", color: "border-red-500/40" },
];

export default function TeamBuilder() {
  const { data: players = [], isLoading } = usePlayers();
  const { data: grades = [] } = useMyPlayerGrades();
  const { data: evaluations = [] } = useEvaluations();
  const { data: template } = useEvaluationTemplate();
  const categories = useMemo(() => template?.categories ?? [], [template]);
  const setGrade = useSetPlayerGrade();
  const [activeTab, setActiveTab] = useState<PlayerGradeValue | "ungraded">("ungraded");

  const gradeMap = useMemo(() => {
    const m: Record<string, PlayerGradeValue> = {};
    grades.forEach(g => { m[g.player_id] = g.grade; });
    return m;
  }, [grades]);

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

  const grouped = useMemo(() => {
    const result: Record<PlayerGradeValue | "ungraded", typeof players> = {
      offer: [], bubble: [], pass: [], ungraded: [],
    };
    players.forEach(p => {
      const g = gradeMap[p.id];
      result[g ?? "ungraded"].push(p);
    });
    return result;
  }, [players, gradeMap]);

  const handleGrade = async (playerId: string, grade: PlayerGradeValue | null) => {
    try {
      await setGrade.mutateAsync({ playerId, grade });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const tabs = [
    { key: "ungraded" as const, label: "Ungraded", count: grouped.ungraded.length },
    ...COLUMNS.map(c => ({ key: c.key, label: c.label, count: grouped[c.key].length })),
  ];

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Team Builder</h1>
          </div>
          <p className="text-sm text-muted-foreground">Grade players as Offer, Bubble, or Pass</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Player List */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />
            ))
          ) : grouped[activeTab].length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No players in this category
            </div>
          ) : (
            grouped[activeTab].map((player, i) => {
              const currentGrade = gradeMap[player.id] ?? null;
              const score = playerScores[player.id];
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-xl p-3 card-elevated space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-foreground">#{player.jersey_number ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {player.first_name} {player.last_name}
                        </span>
                        {currentGrade && <GradeBadge grade={currentGrade} />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getAgeGroup(player.date_of_birth)} · {player.positions.join(", ")} · B:{player.bats} T:{player.throws}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {score && (
                        <OverallScore value={score} showTier className={`text-lg font-bold ${score >= 8 ? "text-primary" : "text-foreground"}`} />
                      )}
                      <Link to={`/evaluate/${player.id}`} className="text-muted-foreground hover:text-foreground">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Grade Buttons */}
                  <div className="flex gap-2">
                    {COLUMNS.map(col => {
                      const isActive = currentGrade === col.key;
                      return (
                        <button
                          key={col.key}
                          onClick={() => handleGrade(player.id, isActive ? null : col.key)}
                          disabled={setGrade.isPending}
                          className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
                            isActive
                              ? `${col.color} bg-secondary text-foreground`
                              : "border-transparent bg-secondary/50 text-muted-foreground hover:bg-secondary"
                          } disabled:opacity-50`}
                        >
                          {isActive && <Check className="w-3 h-3" />}
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Summary */}
        {!isLoading && (
          <div className="bg-card rounded-xl p-4 card-elevated">
            <h3 className="text-sm font-semibold text-foreground mb-3">Summary</h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              {tabs.map(tab => (
                <div key={tab.key}>
                  <div className="text-2xl font-bold text-foreground">{tab.count}</div>
                  <div className="text-xs text-muted-foreground">{tab.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
