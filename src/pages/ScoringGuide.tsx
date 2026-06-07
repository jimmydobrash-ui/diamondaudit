import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { SCORE_TIERS } from "@/lib/scoring";
import { BookOpen, Info } from "lucide-react";

const coachNotes = [
  "Sliders start at zero. Only score what you actually observed — skipping is better than guessing.",
  "Player position and age show at the top of each eval. Calibrate against age and league expectations.",
  "If two coaches score the same player very differently, that's useful information — discuss before final team decisions.",
];

// Subtle accent per tier, high (closer to the majors) -> low.
const tierAccent: Record<string, string> = {
  Unicorn: "text-primary",
  Elite: "text-primary",
  "Above Average": "text-emerald-600 dark:text-emerald-400",
  Average: "text-foreground",
  "Below Average": "text-amber-600 dark:text-amber-400",
  "Needs significant work": "text-muted-foreground",
};

export default function ScoringGuide() {
  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Scoring Guide</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            What each 0–10 score means. All slider scores reflect skill level relative to organized baseball competition.
          </p>
        </motion.div>

        {/* Rubric */}
        <div className="space-y-2">
          {SCORE_TIERS.map((tier, i) => (
            <motion.div
              key={tier.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 bg-card rounded-xl p-4 card-elevated"
            >
              <div className="w-12 flex-shrink-0 text-center">
                <span className={`text-2xl font-bold ${tierAccent[tier.label] ?? "text-foreground"}`}>{tier.range}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{tier.label}</span>
                  {tier.league !== "—" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground">
                      {tier.league}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{tier.meaning}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Slider behavior */}
        <div className="bg-card rounded-xl p-4 card-elevated">
          <h2 className="text-sm font-semibold text-foreground mb-2">Slider behavior</h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Scores 1–8 allow 0.5 increments.</li>
            <li>• Scores 9–10 are whole numbers only.</li>
            <li>• A player's <strong className="text-foreground">overall</strong> is the average of the slider skills they were scored on (raw measurements like velocity in mph aren't part of the 0–10 overall).</li>
          </ul>
        </div>

        {/* Coach notes */}
        <div className="bg-card rounded-xl p-4 card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Notes for coaches</h2>
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {coachNotes.map((note, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
