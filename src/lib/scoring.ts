import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

type Scores = Record<string, number>;

export interface ScoreTier {
  /** Authored score range as shown in the rubric, e.g. "7–8". */
  range: string;
  /** Full tier name, e.g. "Above Average". */
  label: string;
  /** Competition level this tier maps to, e.g. "AAA". */
  league: string;
  /** One-line meaning for the scoring guide. */
  meaning: string;
  /** Compact label for the inline tier tag next to an overall, e.g. "Above Avg (AAA)". */
  badge: string;
  /** Inclusive lower bound used to map a continuous overall (0-10) to a tier. */
  min: number;
}

/**
 * The grading rubric — single source of truth for both the Scoring Guide page
 * and the inline tier tag on a player's overall. Ordered highest tier first.
 * Mirrors the rubric in CLAUDE.md.
 */
export const SCORE_TIERS: ScoreTier[] = [
  { range: "10", label: "Unicorn", league: "MLB", meaning: "Will excel at Major League level", badge: "Unicorn (MLB)", min: 9.5 },
  { range: "9", label: "Elite", league: "MLB", meaning: "Will compete at Major League level", badge: "Elite (MLB)", min: 9 },
  { range: "7–8", label: "Above Average", league: "AAA", meaning: "Will excel at AAA; potential to play Major", badge: "Above Avg (AAA)", min: 7 },
  { range: "5–6", label: "Average", league: "AAA", meaning: "Will compete at AAA", badge: "Average (AAA)", min: 5 },
  { range: "3–4", label: "Below Average", league: "AA", meaning: "Will compete at AA competition level", badge: "Below Avg (AA)", min: 3 },
  { range: "1–2", label: "Needs significant work", league: "—", meaning: "Not yet at AA/AAA competition level", badge: "Needs work", min: 0.0001 },
];

/**
 * Map a continuous overall (0-10) to its rubric tier, or null when there's no
 * score (0). Overalls are averages, so they fall between the authored whole-
 * number tiers; the lower-bound bands keep them aligned with the rubric.
 */
export function scoreTier(value: number): ScoreTier | null {
  if (value <= 0) return null;
  return SCORE_TIERS.find(t => value >= t.min) ?? null;
}

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

export interface CategoryMeasurable {
  id: string;
  label: string;
  unit: string;
  value: number;
}

/**
 * The measurable (number-type) skills in a category that this score map has a
 * value for — e.g. home-to-first time, exit velo. These are deliberately left
 * out of the 0–10 overall (they'd distort the scale), but coaches still need to
 * see and rank by them, so the leaderboard surfaces them directly.
 */
export function categoryMeasurables(scores: Scores, category: TemplateCategory): CategoryMeasurable[] {
  return category.skills
    .filter(s => s.type === "number")
    .map(s => ({ id: s.id, label: s.label, unit: s.unit ?? "", value: scores[s.id] }))
    .filter((m): m is CategoryMeasurable => m.value !== undefined && m.value !== null);
}

/**
 * A category's primary measurable — its first number-type skill — used to rank a
 * category that has no meaningful slider score (e.g. Running, scored purely on
 * home-to-first time). `lowerIsBetter` is true for times (unit "sec"), false
 * otherwise (e.g. velocity in mph), so the leaderboard sorts the fastest first.
 */
export function primaryMeasurable(
  category: TemplateCategory,
): { id: string; unit: string; lowerIsBetter: boolean } | null {
  const s = category.skills.find(sk => sk.type === "number");
  if (!s) return null;
  const unit = s.unit ?? "";
  return { id: s.id, unit, lowerIsBetter: unit === "sec" };
}

export interface MeasurableStanding {
  /** 1 = best in the peer group (competition ranking; ties share a rank). */
  rank: number;
  /** Peers measured on this metric, including the player. */
  total: number;
  /** Percentile rank, 1–99: the % of the peer group this player beat. Clamped
   *  off 0/100 so it never reads "0th"/"100th". Small groups cap it naturally
   *  (best of 12 ≈ 92nd), which is why we show rank alongside it. */
  percentile: number;
}

/**
 * Where a player's measurable (velo, time…) stands within a peer group,
 * computed purely from the tryout's own data — no external benchmarks. Returns
 * null when the group is too small to be meaningful (< `minPeers` measured).
 *
 * `lowerIsBetter` is true for times (unit "sec"), false for velocities, so the
 * fastest time and the hardest throw both rank #1. `peerValues` should include
 * the player's own value.
 */
export function measurableStanding(
  value: number,
  peerValues: number[],
  lowerIsBetter: boolean,
  minPeers = 4,
): MeasurableStanding | null {
  const total = peerValues.length;
  if (total < minPeers) return null;
  const better = peerValues.filter(v => (lowerIsBetter ? v < value : v > value)).length;
  const worse = peerValues.filter(v => (lowerIsBetter ? v > value : v < value)).length;
  const rank = better + 1;
  const percentile = Math.min(99, Math.max(1, Math.round((worse / total) * 100)));
  return { rank, total, percentile };
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

/**
 * The scores to persist for a player: drop null/undefined, and keep only skills
 * belonging to a category that's visible for this player. Hidden categories
 * (e.g. catching for a non-catcher) initialise to a default 5 in the form but
 * must not be saved — otherwise they become phantom scores that distort the
 * player's overall, since the catcher rule is otherwise UI-only. Because the
 * save is a full `scores = EXCLUDED.scores` replace, this also cleans up any
 * pre-existing phantom catching scores when a non-catcher is re-saved.
 */
export function scoresForVisiblePlayer(
  scores: Record<string, number | null>,
  categories: TemplateCategory[],
  positions: string[] | null | undefined,
): Record<string, number> {
  const visibleIds = new Set(
    visibleEvalCategories(categories, positions).flatMap(c => c.skills.map(s => s.id)),
  );
  const out: Record<string, number> = {};
  for (const [skill, value] of Object.entries(scores)) {
    if (value !== null && value !== undefined && visibleIds.has(skill)) out[skill] = value;
  }
  return out;
}
