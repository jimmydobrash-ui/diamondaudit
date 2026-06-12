import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import OverallScore from "@/components/OverallScore";
import GradeBadge from "@/components/GradeBadge";
import { usePlayers, useDeletePlayer } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { usePlayerGrades, type PlayerGradeValue } from "@/hooks/usePlayerGrades";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useAuth } from "@/hooks/useAuth";
import { getAgeGroup } from "@/lib/mock-data";
import {
  aggregateScoresByPlayer,
  calcSliderOverall,
  calcCategoryAvg,
  visibleEvalCategories,
} from "@/lib/scoring";
import { ArrowLeft, ClipboardList, Users, Trash2 } from "lucide-react";

type Scores = Record<string, number>;

export default function PlayerDetail() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: evaluations = [], isLoading: evalsLoading } = useEvaluations();
  const { data: grades = [] } = usePlayerGrades();
  const { data: template } = useEvaluationTemplate();
  const { data: members = {} } = useOrgMembers();
  const { role } = useAuth();
  const deletePlayer = useDeletePlayer();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const player = players.find(p => p.id === playerId);
  const categories = useMemo(() => template?.categories ?? [], [template]);
  const visibleCategories = useMemo(
    () => visibleEvalCategories(categories, player?.positions),
    [categories, player?.positions],
  );

  const playerEvals = useMemo(
    () => evaluations.filter(e => e.player_id === playerId),
    [evaluations, playerId],
  );

  // Team consensus: average each skill across coaches, then the overall + per-category.
  const consensus = useMemo(() => {
    const agg = aggregateScoresByPlayer(
      playerEvals.map(e => ({ player_id: e.player_id, scores: e.scores as Scores })),
    )[playerId ?? ""] ?? {};
    return {
      scores: agg,
      overall: calcSliderOverall(agg, categories),
      categories: visibleCategories.map(c => ({ name: c.name, avg: calcCategoryAvg(agg, c) })),
    };
  }, [playerEvals, playerId, categories, visibleCategories]);

  const isLoading = playersLoading || evalsLoading;

  const handleDelete = async () => {
    if (!playerId) return;
    try {
      await deletePlayer.mutateAsync(playerId);
      toast.success("Player deleted");
      navigate("/players");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isLoading && !player) {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground">Player not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-4 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <span className="text-xl font-bold text-foreground">#{player?.jersey_number ?? "?"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{player?.first_name} {player?.last_name}</h1>
            {player && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{getAgeGroup(player.date_of_birth)}</span>
                <span>·</span>
                <span>{player.positions.join(", ") || "No position"}</span>
                <span>·</span>
                <span>B:{player.bats} T:{player.throws}</span>
                {player.height && <><span>·</span><span>{player.height} {player.weight}lbs</span></>}
              </div>
            )}
          </div>
        </motion.div>

        {/* Team consensus */}
        <div className="bg-card rounded-xl p-4 card-elevated">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Team consensus</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {playerEvals.length} {playerEvals.length === 1 ? "evaluation" : "evaluations"}
            </span>
          </div>

          {playerEvals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Not evaluated yet.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <OverallScore value={consensus.overall} showTier className="text-3xl font-bold text-foreground" />
              </div>
              <div className="space-y-1.5">
                {consensus.categories.filter(c => c.avg !== null).map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0 truncate">{c.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${((c.avg ?? 0) / 10) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-8 text-right tabular-nums">{c.avg}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* By coach */}
        {playerEvals.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground px-1">By coach</h2>
            {playerEvals.map(ev => {
              const coachName = members[ev.coach_id]?.name ?? "Coach";
              const overall = calcSliderOverall(ev.scores as Scores, categories);
              const grade = grades.find(g => g.player_id === playerId && g.coach_id === ev.coach_id)?.grade as PlayerGradeValue | undefined;
              return (
                <div key={ev.id} className="bg-card rounded-xl p-3 card-elevated">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{coachName}</span>
                        {grade && <GradeBadge grade={grade} />}
                      </div>
                      {ev.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.notes}</p>}
                    </div>
                    <OverallScore value={overall} showTier className="text-lg font-bold text-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Evaluate CTA */}
        <Link
          to={`/evaluate/${playerId}`}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          Evaluate player
        </Link>

        {/* Delete (admin only) */}
        {role === "admin" && (
          confirmDelete ? (
            <div className="bg-card rounded-xl p-4 card-elevated border border-destructive/30 space-y-3">
              <p className="text-sm text-foreground">
                Delete <strong>{player?.first_name} {player?.last_name}</strong>? This also removes their evaluations and grades and can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletePlayer.isPending}
                  className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {deletePlayer.isPending ? "Deleting…" : "Delete player"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full h-10 rounded-xl text-destructive text-sm font-medium flex items-center justify-center gap-2 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete player
            </button>
          )
        )}
      </div>
    </AppLayout>
  );
}
