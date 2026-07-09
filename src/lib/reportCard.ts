import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";
import { playerAgeGroup } from "./mock-data";
import {
  calcSliderOverall,
  calcCategoryAvg,
  categoryMeasurables,
  measurableStanding,
  scoreTier,
  type ScoreTier,
  type CategoryMeasurable,
  type MeasurableStanding,
} from "./scoring";

type Scores = Record<string, number>;

export interface ReportMeasurable extends CategoryMeasurable {
  standing: MeasurableStanding | null;
}

export interface ReportCategory {
  name: string;
  hasSliderSkills: boolean;
  avg: number | null;
  tier: ScoreTier | null;
  measurables: ReportMeasurable[];
}

export interface ReportData {
  overall: number;
  overallTier: ScoreTier | null;
  categories: ReportCategory[];
}

/** skillId -> aggregated values of every peer measured on it (for percentiles). */
export type PeerValues = Record<string, number[]>;

/**
 * Build the display model for one player's report card from their aggregated
 * (cross-coach) scores. Pure, so the single report page and the bulk export
 * render exactly the same thing. `peerValues` should already be scoped to the
 * player's age group.
 */
export function buildPlayerReport(
  agg: Scores,
  peerValues: PeerValues,
  categories: TemplateCategory[],
  visibleCategories: TemplateCategory[],
): ReportData {
  const overall = calcSliderOverall(agg, categories);
  const skillById = new Map(categories.flatMap(c => c.skills.map(s => [s.id, s] as const)));
  return {
    overall,
    overallTier: scoreTier(overall),
    categories: visibleCategories
      .map(cat => {
        // A category made up entirely of number-type skills (e.g. Running) has
        // no slider average and therefore no tier.
        const hasSliderSkills = cat.skills.some(s => s.type === "slider");
        const avg = hasSliderSkills ? calcCategoryAvg(agg, cat) : null;
        return {
          name: cat.name,
          hasSliderSkills,
          avg,
          tier: avg !== null ? scoreTier(avg) : null,
          measurables: categoryMeasurables(agg, cat).map(m => {
            const lowerIsBetter = (skillById.get(m.id)?.unit ?? "") === "sec"; // times: faster is better
            return { ...m, standing: measurableStanding(m.value, peerValues[m.id] ?? [], lowerIsBetter) };
          }),
        };
      })
      .filter(c => c.avg !== null || c.measurables.length > 0),
  };
}

/**
 * skillId -> peer values, for every player in `group` (used by the single
 * report page for one player's peer set).
 */
export function peerValuesForGroup(
  group: string,
  players: { id: string; date_of_birth: string; tags: string[] | null }[],
  allAggregates: Record<string, Scores>,
): PeerValues {
  const bySkill: PeerValues = {};
  for (const p of players) {
    if (playerAgeGroup(p) !== group) continue;
    const scores = allAggregates[p.id];
    if (!scores) continue;
    for (const [skill, value] of Object.entries(scores)) {
      if (value == null) continue;
      (bySkill[skill] ??= []).push(value);
    }
  }
  return bySkill;
}

/**
 * All age groups' peer distributions in one pass — group -> skillId -> values.
 * Used by the bulk export so we don't recompute per player.
 */
export function peerValuesByGroup(
  players: { id: string; date_of_birth: string; tags: string[] | null }[],
  allAggregates: Record<string, Scores>,
): Record<string, PeerValues> {
  const out: Record<string, PeerValues> = {};
  for (const p of players) {
    const scores = allAggregates[p.id];
    if (!scores) continue;
    const group = playerAgeGroup(p);
    const bySkill = (out[group] ??= {});
    for (const [skill, value] of Object.entries(scores)) {
      if (value == null) continue;
      (bySkill[skill] ??= []).push(value);
    }
  }
  return out;
}

/** A file-system-safe report filename for a player, e.g. "07-Jackson-Kaye.pdf". */
export function reportFileName(p: {
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}): string {
  const jersey = p.jersey_number != null ? String(p.jersey_number).padStart(2, "0") + "-" : "";
  const name = `${p.first_name}-${p.last_name}`.replace(/[^a-zA-Z0-9-]/g, "");
  return `${jersey}${name}.pdf`;
}
