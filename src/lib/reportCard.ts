import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";
import { playerAgeGroup } from "./mock-data";
import {
  aggregateScoresByPlayer,
  calcSliderOverall,
  calcCategoryAvg,
  categoryMeasurables,
  measurableStanding,
  scoreTier,
  visibleEvalCategories,
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

export interface PlayerNote {
  coachName: string;
  text: string;
}

export interface ReportData {
  overall: number;
  overallTier: ScoreTier | null;
  categories: ReportCategory[];
  /** Coach notes for this player — included only when explicitly requested
   *  (see buildReportCardBundle's `includeNotes`). The family-facing single
   *  report page and the regular bulk export never pass these; only the
   *  internal season archive does. */
  notes?: PlayerNote[];
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
  notes?: PlayerNote[],
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
    notes,
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

/** This player's coach notes, named by coach — skips empty/whitespace-only
 *  notes. `evaluations` doesn't need to be pre-filtered to this player;
 *  filtering happens here, mirroring the exact pattern already used inline in
 *  PlayerDetail.tsx's "By coach" list (same "Coach" fallback name). */
export function playerNotesFromEvaluations(
  playerId: string,
  evaluations: { player_id: string; coach_id: string; notes: string | null }[],
  memberNameById: Record<string, string>,
): PlayerNote[] {
  return evaluations
    .filter(e => e.player_id === playerId && !!e.notes?.trim())
    .map(e => ({ coachName: memberNameById[e.coach_id] ?? "Coach", text: e.notes as string }));
}

// Matches every field ReportCardDocument actually renders (name, jersey, age
// group, positions, bats/throws) — kept as an explicit list rather than the
// full Player row so a future roster column doesn't silently become "required"
// here.
export type ReportCardPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  tags: string[] | null;
  positions: string[];
  jersey_number: number | null;
  bats: string;
  throws: string;
};
type BundleEvaluation = { player_id: string; coach_id: string; scores: Scores; notes: string | null };

export interface ReportCardBundleItem {
  player: ReportCardPlayer;
  filename: string;
  evalCount: number;
  report: ReportData;
}

/**
 * Shared card-assembly step behind both the family-facing bulk report-card
 * export (ReportCards.tsx) and the internal season archive — same aggregation
 * and peer-percentile math either way, so the two screens can never drift
 * apart. `scopedPlayers` is the (already filtered + sorted) set to actually
 * build cards for; `allPlayers` stays the full roster so percentile standings
 * are always computed against a player's true age-group peers regardless of
 * what's currently in scope. `includeNotes` is what distinguishes the
 * archive's internal record (true) from the two family-facing call sites
 * (false/omitted) — coach notes are not meant for families.
 */
export function buildReportCardBundle(input: {
  scopedPlayers: ReportCardPlayer[];
  allPlayers: ReportCardPlayer[];
  evaluations: BundleEvaluation[];
  categories: TemplateCategory[];
  /** Nest each file under an age-group folder — pass true for a multi-group export. */
  folderPerGroup: boolean;
  includeNotes?: boolean;
  memberNameById?: Record<string, string>;
}): ReportCardBundleItem[] {
  const { scopedPlayers, allPlayers, evaluations, categories, folderPerGroup, includeNotes = false, memberNameById = {} } = input;

  const evalCounts: Record<string, number> = {};
  for (const e of evaluations) evalCounts[e.player_id] = (evalCounts[e.player_id] ?? 0) + 1;

  const allAggregates = aggregateScoresByPlayer(evaluations.map(e => ({ player_id: e.player_id, scores: e.scores })));
  const peerValues = peerValuesByGroup(allPlayers, allAggregates);

  return scopedPlayers.map(p => {
    const pGroup = playerAgeGroup(p);
    return {
      player: p,
      filename: bulkReportFileName(p, folderPerGroup ? pGroup : null),
      evalCount: evalCounts[p.id] ?? 0,
      report: buildPlayerReport(
        allAggregates[p.id] ?? {},
        peerValues[pGroup] ?? {},
        categories,
        visibleEvalCategories(categories, p.positions),
        includeNotes ? playerNotesFromEvaluations(p.id, evaluations, memberNameById) : undefined,
      ),
    };
  });
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

/**
 * The zip entry path for a bulk export. When `folder` is given (a "download
 * all age groups" export), the file is nested under an age-group folder —
 * jersey numbers reset per age group, so two 10U/11U players could otherwise
 * collide and overwrite each other in a flat zip. A single-group export
 * (`folder` null) stays flat, unchanged from before this existed.
 */
export function bulkReportFileName(
  p: { first_name: string; last_name: string; jersey_number: number | null },
  folder: string | null,
): string {
  const base = reportFileName(p);
  return folder ? `${folder}/${base}` : base;
}
