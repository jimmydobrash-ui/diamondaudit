import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

type Scores = Record<string, number>;

/** Round to one decimal place (e.g. 7.25 -> 7.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Flat average of every score value, regardless of skill type.
 * Used by the evaluate list and team builder for a quick "overall" number.
 * Note: this includes number-type skills (e.g. velocity in mph), so it is a
 * rough indicator, not the calibrated leaderboard overall.
 */
export function calcFlatOverall(scores: Scores): number {
  const vals = Object.values(scores);
  if (!vals.length) return 0;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Average of slider-type skills only, across all categories. This is the
 * calibrated overall shown on the leaderboard — number skills (mph, sec) are
 * excluded so they don't distort the 1-10 scale.
 */
export function calcSliderOverall(scores: Scores, categories: TemplateCategory[]): number {
  const sliderIds = new Set(
    categories.flatMap(c => c.skills.filter(s => s.type === "slider").map(s => s.id)),
  );
  const vals = Object.entries(scores)
    .filter(([k]) => sliderIds.has(k))
    .map(([, v]) => v);
  if (!vals.length) return 0;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Average of the slider-type skills within a single category, or null when no
 * slider skills in that category were scored.
 */
export function calcCategoryAvg(scores: Scores, category: TemplateCategory): number | null {
  const sliderSkills = category.skills.filter(s => s.type === "slider");
  const vals = sliderSkills.map(s => scores[s.id]).filter((v): v is number => v !== undefined);
  if (!vals.length) return null;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * The evaluation categories visible for a player given their positions.
 * The "catching" category is hidden for players whose positions are set and do
 * not include "C". An empty/unset positions list shows all categories.
 */
export function visibleEvalCategories(
  categories: TemplateCategory[],
  positions: string[] | null | undefined,
): TemplateCategory[] {
  const pos = positions ?? [];
  if (pos.length === 0) return categories;
  if (pos.includes("C")) return categories;
  return categories.filter(cat => cat.id !== "catching");
}
