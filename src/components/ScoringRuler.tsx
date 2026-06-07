// A calibration "ruler" shown above the sliders on the evaluate page. Its zones
// are laid out proportionally across the 1-10 slider domain (9 units wide) so
// each tier sits directly above where that score lands on the sliders below,
// helping coaches score to the rubric in the moment. Mirrors SCORE_TIERS in
// lib/scoring.ts (9 and 10 are merged here into one "Elite+" zone so the label
// fits).
const ZONES = [
  { range: "1–2", label: "Needs work", units: 2, tint: "bg-muted/50 text-muted-foreground" },
  { range: "3–4", label: "Below Avg", units: 2, tint: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  { range: "5–6", label: "Average", units: 2, tint: "bg-secondary text-foreground" },
  { range: "7–8", label: "Above Avg", units: 2, tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  { range: "9–10", label: "Elite+", units: 1, tint: "bg-primary/10 text-primary" },
];

const TOTAL_UNITS = ZONES.reduce((sum, z) => sum + z.units, 0);

export default function ScoringRuler() {
  return (
    <div className="flex items-center gap-3 mb-3">
      {/* Matches the slider rows' label column so the ruler lines up with the tracks */}
      <span className="w-24 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Scale
      </span>
      <div className="flex-1 flex rounded-lg overflow-hidden border border-border">
        {ZONES.map(zone => (
          <div
            key={zone.label}
            style={{ flexBasis: `${(zone.units / TOTAL_UNITS) * 100}%` }}
            className={`flex flex-col items-center justify-center py-1 px-0.5 border-r border-border/60 last:border-r-0 ${zone.tint}`}
          >
            <span className="text-[10px] font-bold leading-none tabular-nums">{zone.range}</span>
            <span className="text-[9px] leading-tight opacity-80 truncate w-full text-center">{zone.label}</span>
          </div>
        ))}
      </div>
      {/* Matches the slider rows' value column */}
      <span className="w-8 flex-shrink-0" />
    </div>
  );
}
