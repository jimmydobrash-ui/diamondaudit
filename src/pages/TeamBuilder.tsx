import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import GradeBadge from "@/components/GradeBadge";
import TeamBuilderRosterSummary from "@/components/TeamBuilderRosterSummary";
import { sortByScoreThenName, positionCounts, offerListCsv } from "@/components/TeamBuilderMath";
import { usePlayers } from "@/hooks/usePlayers";
import { useMyPlayerGrades, useSetPlayerGrade, type PlayerGradeValue } from "@/hooks/usePlayerGrades";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { useAuth } from "@/hooks/useAuth";
import { playerAgeGroup, sortAgeGroups } from "@/lib/mock-data";
import { calcSliderOverall, aggregateScoresByPlayer } from "@/lib/scoring";
import { downloadCsv } from "@/lib/csv";
import { useHasMounted } from "@/hooks/useHasMounted";
import OverallScore from "@/components/OverallScore";
import { Layers, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

const COLUMNS: { key: PlayerGradeValue; label: string; color: string }[] = [
  { key: "offer", label: "Offer", color: "border-emerald-500/40" },
  { key: "bubble", label: "Bubble", color: "border-amber-500/40" },
  { key: "pass", label: "Pass", color: "border-red-500/40" },
];

// A sensible youth-baseball default; the coach adjusts it per age group and it
// persists per org+group in localStorage (single-admin-device v1).
const DEFAULT_ROSTER_TARGET = 12;
const rosterTargetsKey = (orgId: string) => `da:teambuilder:roster-targets:${orgId}`;

export default function TeamBuilder() {
  const hasMounted = useHasMounted();
  const { organizationId } = useAuth();
  const { data: players = [], isLoading } = usePlayers();
  const { data: grades = [] } = useMyPlayerGrades();
  const { data: evaluations = [] } = useEvaluations();
  const { data: template } = useEvaluationTemplate();
  const categories = useMemo(() => template?.categories ?? [], [template]);
  const setGrade = useSetPlayerGrade();
  const [activeTab, setActiveTab] = useState<PlayerGradeValue | "ungraded">("ungraded");
  const [ageFilter, setAgeFilter] = useState("all");
  const [rosterTargets, setRosterTargets] = useState<Record<string, number>>({});

  // Load persisted per-age-group roster targets once the org is known. A shared
  // org-wide target would need a DB column; localStorage is fine for the single
  // admin running the tryout on one device.
  useEffect(() => {
    if (!organizationId) return;
    try {
      const raw = localStorage.getItem(rosterTargetsKey(organizationId));
      setRosterTargets(raw ? JSON.parse(raw) : {});
    } catch {
      setRosterTargets({});
    }
  }, [organizationId]);

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

  const ageGroups = useMemo(
    () => sortAgeGroups([...new Set(players.map(p => playerAgeGroup(p)))]),
    [players],
  );

  const scopedPlayers = useMemo(
    () => (ageFilter === "all" ? players : players.filter(p => playerAgeGroup(p) === ageFilter)),
    [players, ageFilter],
  );

  // Group by grade within the selected age group, then rank each column
  // (highest overall first, unevaluated last alphabetically) so the Bubble tab
  // reads as a decision queue.
  const grouped = useMemo(() => {
    const result: Record<PlayerGradeValue | "ungraded", typeof players> = {
      offer: [], bubble: [], pass: [], ungraded: [],
    };
    scopedPlayers.forEach(p => {
      const g = gradeMap[p.id];
      result[g ?? "ungraded"].push(p);
    });
    const scoreOf = (id: string) => playerScores[id];
    (Object.keys(result) as (PlayerGradeValue | "ungraded")[]).forEach(k => {
      result[k] = sortByScoreThenName(result[k], scoreOf);
    });
    return result;
  }, [scopedPlayers, gradeMap, playerScores]);

  const offeredPositions = useMemo(() => positionCounts(grouped.offer), [grouped.offer]);

  const rosterTarget =
    ageFilter === "all" ? DEFAULT_ROSTER_TARGET : rosterTargets[ageFilter] ?? DEFAULT_ROSTER_TARGET;

  const setRosterTarget = (next: number) => {
    if (ageFilter === "all" || !organizationId) return;
    const clamped = Math.max(1, Math.min(40, Math.round(next)));
    setRosterTargets(prev => {
      const updated = { ...prev, [ageFilter]: clamped };
      try {
        localStorage.setItem(rosterTargetsKey(organizationId), JSON.stringify(updated));
      } catch {
        /* private mode / quota — keep the in-memory value */
      }
      return updated;
    });
  };

  const handleGrade = async (playerId: string, grade: PlayerGradeValue | null) => {
    try {
      await setGrade.mutateAsync({ playerId, grade });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExport = () => {
    const offers = grouped.offer;
    if (offers.length === 0) return;
    const csv = offerListCsv(offers, id => playerScores[id]);
    const scope = ageFilter === "all" ? "all" : ageFilter;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`diamondaudit-offers-${scope}-${date}.csv`, csv);
    toast.success(`Exported ${offers.length} offer${offers.length === 1 ? "" : "s"}`);
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
          <p className="text-sm text-muted-foreground">Grade players and build your roster by age group</p>
        </motion.div>

        {/* Age-group filter — build rosters one group at a time */}
        {ageGroups.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setAgeFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>All Ages</button>
            {ageGroups.map(ag => (
              <button key={ag} onClick={() => setAgeFilter(ag)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${ageFilter === ag ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{ag}</button>
            ))}
          </div>
        )}

        {/* Roster math + position coverage + export */}
        {!isLoading && players.length > 0 && (
          <TeamBuilderRosterSummary
            ageGroup={ageFilter}
            offeredCount={grouped.offer.length}
            bubbleCount={grouped.bubble.length}
            target={rosterTarget}
            onTargetChange={setRosterTarget}
            positions={offeredPositions}
            onExport={handleExport}
          />
        )}

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
              {ageFilter === "all"
                ? "No players in this category"
                : `No ${ageFilter} players in this category`}
            </div>
          ) : (
            grouped[activeTab].map((player, i) => {
              const currentGrade = gradeMap[player.id] ?? null;
              const score = playerScores[player.id];
              return (
                <motion.div
                  key={player.id}
                  initial={hasMounted.current ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={hasMounted.current ? undefined : { delay: i * 0.03 }}
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
                        {playerAgeGroup(player)} · {player.positions.join(", ")} · B:{player.bats} T:{player.throws}
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
      </div>
    </AppLayout>
  );
}
