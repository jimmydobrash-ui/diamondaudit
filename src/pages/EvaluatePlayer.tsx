import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import EvaluationSlider from "@/components/EvaluationSlider";
import EvaluationNumberInput from "@/components/EvaluationNumberInput";
import { getAgeGroup } from "@/lib/mock-data";
import { visibleEvalCategories } from "@/lib/scoring";
import { usePlayers } from "@/hooks/usePlayers";
import { usePlayerEvaluation, useSaveEvaluation } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { useMyPlayerGrades, useSetPlayerGrade, type PlayerGradeValue } from "@/hooks/usePlayerGrades";
import GradeBadge from "@/components/GradeBadge";
import { ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import { toast } from "sonner";

export default function EvaluatePlayer() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { data: players = [] } = usePlayers();
  const { data: existingEval } = usePlayerEvaluation(playerId);
  const { data: template } = useEvaluationTemplate();
  const { data: myGrades = [] } = useMyPlayerGrades();
  const setGradeMutation = useSetPlayerGrade();
  const saveEval = useSaveEvaluation();

  const player = players.find(p => p.id === playerId);
  const [activeCategory, setActiveCategory] = useState(0);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const categories = template?.categories ?? [];
  const visibleCategories = visibleEvalCategories(categories, player?.positions);

  // Initialize scores from existing evaluation or defaults
  useEffect(() => {
    if (initialized || !categories.length) return;
    const existing = existingEval?.scores as Record<string, number> | undefined;
    const initial: Record<string, number | null> = {};
    categories.forEach(cat => {
      cat.skills.forEach(skill => {
        if (skill.type === "slider") {
          initial[skill.id] = existing?.[skill.id] ?? 5;
        } else {
          initial[skill.id] = existing?.[skill.id] ?? null;
        }
      });
    });
    setScores(initial);
    setNotes(existingEval?.notes ?? player?.notes ?? "");
    if (existingEval !== undefined || player) setInitialized(true);
  }, [existingEval, player, initialized, categories]);

  // Reset when player changes
  useEffect(() => {
    setInitialized(false);
    setSaved(false);
    setActiveCategory(0);
  }, [playerId]);

  const handleScoreChange = useCallback((skillId: string, value: number | null) => {
    setScores(prev => ({ ...prev, [skillId]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!playerId) return;
    // Filter out null values for storage
    const cleanScores: Record<string, number> = {};
    Object.entries(scores).forEach(([k, v]) => {
      if (v !== null && v !== undefined) cleanScores[k] = v;
    });
    try {
      await saveEval.mutateAsync({ playerId, scores: cleanScores, notes });
      setSaved(true);
      toast.success("Evaluation saved!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveAndNext = async () => {
    await handleSave();
    const currentIndex = players.findIndex(p => p.id === playerId);
    if (currentIndex < players.length - 1) {
      navigate(`/evaluate/${players[currentIndex + 1].id}`);
    } else {
      navigate("/evaluate");
    }
  };

  if (!player && players.length > 0) {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground">Player not found</div>
      </AppLayout>
    );
  }

  if (!player || !categories.length) {
    return (
      <AppLayout>
        <div className="container py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const currentCategory = visibleCategories[activeCategory];
  const playerIndex = players.findIndex(p => p.id === playerId);
  const prevPlayer = playerIndex > 0 ? players[playerIndex - 1] : null;
  const nextPlayer = playerIndex < players.length - 1 ? players[playerIndex + 1] : null;

  return (
    <AppLayout>
      <div className="container py-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/evaluate")} className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <span className="text-xl font-bold text-foreground">#{player.jersey_number ?? "?"}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{player.first_name} {player.last_name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getAgeGroup(player.date_of_birth)}</span>
              <span>·</span>
              <span>{player.positions.join(", ")}</span>
              <span>·</span>
              <span>B:{player.bats} T:{player.throws}</span>
              {player.height && <><span>·</span><span>{player.height} {player.weight}lbs</span></>}
            </div>
          </div>
        </motion.div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {visibleCategories.map((cat, i) => (
            <button key={cat.id} onClick={() => setActiveCategory(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeCategory === i ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
            >{cat.name}</button>
          ))}
        </div>

        {currentCategory && (
          <motion.div key={currentCategory.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="space-y-1 bg-card rounded-xl p-4 card-elevated">
            <h2 className="text-sm font-semibold text-foreground mb-3">{currentCategory.name}</h2>
            {currentCategory.skills.map(skill =>
              skill.type === "number" ? (
                <EvaluationNumberInput
                  key={skill.id}
                  label={skill.label}
                  value={(scores[skill.id] as number | null) ?? null}
                  unit={skill.unit ?? ""}
                  onChange={v => handleScoreChange(skill.id, v)}
                />
              ) : (
                <EvaluationSlider
                  key={skill.id}
                  label={skill.label}
                  value={(scores[skill.id] as number) ?? 5}
                  onChange={v => handleScoreChange(skill.id, v)}
                />
              )
            )}
          </motion.div>
        )}

        {/* Grade Selection */}
        {(() => {
          const currentGrade = myGrades.find(g => g.player_id === playerId)?.grade ?? null;
          const gradeOptions: { key: PlayerGradeValue; label: string; color: string }[] = [
            { key: "offer", label: "Offer", color: "border-emerald-500/40" },
            { key: "bubble", label: "Bubble", color: "border-amber-500/40" },
            { key: "pass", label: "Pass", color: "border-red-500/40" },
          ];
          return (
            <div className="bg-card rounded-xl p-4 card-elevated">
              <label className="text-sm font-semibold text-foreground block mb-2">Player Grade</label>
              <div className="flex gap-2">
                {gradeOptions.map(opt => {
                  const isActive = currentGrade === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => playerId && setGradeMutation.mutateAsync({ playerId, grade: isActive ? null : opt.key }).catch((e: any) => toast.error(e.message))}
                      disabled={setGradeMutation.isPending}
                      className={`flex-1 h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
                        isActive
                          ? `${opt.color} bg-secondary text-foreground`
                          : "border-transparent bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      } disabled:opacity-50`}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="bg-card rounded-xl p-4 card-elevated">
          <label className="text-sm font-semibold text-foreground block mb-2">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add evaluation notes..." className="w-full h-20 bg-secondary rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saveEval.isPending}
            className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${saved ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved" : "Save"}
          </button>
          <button onClick={handleSaveAndNext} disabled={saveEval.isPending}
            className="flex-1 h-12 rounded-xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Save & Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pb-4">
          {prevPlayer ? (
            <button onClick={() => navigate(`/evaluate/${prevPlayer.id}`)} className="flex items-center gap-1 touch-target">
              <ArrowLeft className="w-3 h-3" /> #{prevPlayer.jersey_number} {prevPlayer.last_name}
            </button>
          ) : <span />}
          <span>{playerIndex + 1} of {players.length}</span>
          {nextPlayer ? (
            <button onClick={() => navigate(`/evaluate/${nextPlayer.id}`)} className="flex items-center gap-1 touch-target">
              #{nextPlayer.jersey_number} {nextPlayer.last_name} <ArrowRight className="w-3 h-3" />
            </button>
          ) : <span />}
        </div>
      </div>
    </AppLayout>
  );
}
