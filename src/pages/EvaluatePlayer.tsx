import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import EvaluationSlider from "@/components/EvaluationSlider";
import { mockPlayers, mockEvaluations, evaluationTemplate, getAgeGroup, getPlayingAge } from "@/lib/mock-data";
import { ArrowLeft, ArrowRight, Save, Check } from "lucide-react";
import { toast } from "sonner";

export default function EvaluatePlayer() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const player = mockPlayers.find(p => p.id === playerId);
  const [activeCategory, setActiveCategory] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const existing = playerId ? mockEvaluations[playerId] : {};
    const initial: Record<string, number> = {};
    evaluationTemplate.forEach(cat => {
      cat.skills.forEach(skill => {
        initial[skill.id] = existing?.[skill.id] ?? 5;
      });
    });
    return initial;
  });
  const [notes, setNotes] = useState(player?.notes ?? "");
  const [saved, setSaved] = useState(false);

  const handleScoreChange = useCallback((skillId: string, value: number) => {
    setScores(prev => ({ ...prev, [skillId]: value }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    // In production, this would save to Supabase
    if (playerId) {
      mockEvaluations[playerId] = { ...scores };
    }
    setSaved(true);
    toast.success("Evaluation saved!");
  };

  const handleSaveAndNext = () => {
    handleSave();
    const currentIndex = mockPlayers.findIndex(p => p.id === playerId);
    if (currentIndex < mockPlayers.length - 1) {
      navigate(`/evaluate/${mockPlayers[currentIndex + 1].id}`);
    } else {
      navigate("/evaluate");
    }
  };

  if (!player) {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground">Player not found</div>
      </AppLayout>
    );
  }

  const currentCategory = evaluationTemplate[activeCategory];
  const playerIndex = mockPlayers.findIndex(p => p.id === playerId);
  const prevPlayer = playerIndex > 0 ? mockPlayers[playerIndex - 1] : null;
  const nextPlayer = playerIndex < mockPlayers.length - 1 ? mockPlayers[playerIndex + 1] : null;

  return (
    <AppLayout>
      <div className="container py-4 space-y-4">
        {/* Player Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => navigate("/evaluate")}
            className="touch-target flex items-center justify-center text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <span className="text-xl font-bold text-foreground">#{player.jerseyNumber}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {player.firstName} {player.lastName}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{getAgeGroup(player.dateOfBirth)}</span>
              <span>·</span>
              <span>{player.positions.join(', ')}</span>
              <span>·</span>
              <span>B:{player.bats} T:{player.throws}</span>
              <span>·</span>
              <span>{player.height} {player.weight}lbs</span>
            </div>
          </div>
        </motion.div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {evaluationTemplate.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === i
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <motion.div
          key={currentCategory.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-1 bg-card rounded-xl p-4 card-elevated"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">{currentCategory.name}</h2>
          {currentCategory.skills.map(skill => (
            <EvaluationSlider
              key={skill.id}
              label={skill.label}
              value={scores[skill.id] ?? 5}
              onChange={(v) => handleScoreChange(skill.id, v)}
            />
          ))}
        </motion.div>

        {/* Notes */}
        <div className="bg-card rounded-xl p-4 card-elevated">
          <label className="text-sm font-semibold text-foreground block mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add evaluation notes..."
            className="w-full h-20 bg-secondary rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className={`flex-1 h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              saved
                ? "bg-success text-success-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={handleSaveAndNext}
            className="flex-1 h-12 rounded-xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2"
          >
            Save & Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Nav */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-4">
          {prevPlayer ? (
            <button
              onClick={() => navigate(`/evaluate/${prevPlayer.id}`)}
              className="flex items-center gap-1 touch-target"
            >
              <ArrowLeft className="w-3 h-3" />
              #{prevPlayer.jerseyNumber} {prevPlayer.lastName}
            </button>
          ) : <span />}
          <span>{playerIndex + 1} of {mockPlayers.length}</span>
          {nextPlayer ? (
            <button
              onClick={() => navigate(`/evaluate/${nextPlayer.id}`)}
              className="flex items-center gap-1 touch-target"
            >
              #{nextPlayer.jerseyNumber} {nextPlayer.lastName}
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : <span />}
        </div>
      </div>
    </AppLayout>
  );
}
