import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

type Scores = Record<string, number>;

/** Round to one decimal place (e.g. 7.25 -> 7.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Roll up multiple evaluations of the same players (e.g. from different coaches)
 * into one per-skill score map per player, averaging each skill across the
 * evaluations that scored it (rounded to one decimal). This is the canonical
 * cross-coach aggregation: build a composite per-skill profile first, then feed
 * it to calcSliderOverall / calcCategoryAvg. Every screen uses this so the same
 * player reads the same overall regardless of how many coaches scored them.
 */
export function aggregateScoresByPlayer(
  evaluations: { player_id: string; scores: Scores }[],
): Record<string, Scores> {
  const buckets: Record<string, { sums: Scores; counts: Record<string, number> }> = {};
  for (const ev of evaluations) {
    const bucket = (buckets[ev.player_id] ??= { sums: {}, counts: {} });
    for (const [skill, value] of Object.entries(ev.scores ?? {})) {
      if (value === null || value === undefined) continue;
      bucket.sums[skill] = (bucket.sums[skill] ?? 0) + value;
      bucket.counts[skill] = (bucket.counts[skill] ?? 0) + 1;
    }
  }
  const result: Record<string, Scores> = {};
  for (const [playerId, bucket] of Object.entries(buckets)) {
    const aggregated: Scores = {};
    for (const skill of Object.keys(bucket.sums)) {
      aggregated[skill] = round1(bucket.sums[skill] / bucket.counts[skill]);
    }
    result[playerId] = aggregated;
  }
  return result;
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
