import JSZip from "jszip";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";
import type { PlayerGradeValue } from "@/hooks/usePlayerGrades";
import { playerAgeGroup, sortAgeGroups } from "./mock-data";
import { aggregateScoresByPlayer, calcCategoryAvg, calcSliderOverall, scoreTier, SCORE_TIERS, round1 } from "./scoring";

type Scores = Record<string, number>;

// Deliberately narrow input shapes — no name, jersey, height/weight, or notes
// field exists on any of these, so a caller literally cannot pass PII in even
// by accident. date_of_birth/tags are consumed only to derive an age-group
// label (never echoed back raw) via the same playerAgeGroup() the rest of the
// app uses, so a benchmark's grouping always matches what a coach sees.
export interface BenchmarkPlayerInput {
  id: string;
  date_of_birth: string;
  tags: string[] | null;
}
export interface BenchmarkEvaluationInput {
  player_id: string;
  scores: Scores;
}
export interface BenchmarkGradeInput {
  player_id: string;
  grade: PlayerGradeValue;
}

export interface MeasurableBenchmark {
  categoryName: string;
  skillId: string;
  label: string;
  unit: string;
  count: number;
  avg: number;
  min: number;
  max: number;
}

export interface SliderCategoryBenchmark {
  categoryName: string;
  /** Players with a value for this category, out of the group's evaluated count. */
  count: number;
  avg: number;
}

export interface GradeCounts {
  offer: number;
  bubble: number;
  pass: number;
  /** offer + bubble + pass. Counted per coach-grade-row (a player graded by
   *  three coaches contributes three rows) — there is no "resolved" single
   *  grade per player anywhere in the product today, so this mirrors what the
   *  app itself already shows (PlayerDetail's "By coach" list). */
  total: number;
}

export interface TierBucket {
  /** A SCORE_TIERS label, or "Not yet evaluated" for players with no scored overall. */
  label: string;
  count: number;
}

export interface AgeGroupBenchmark {
  /** An actual age-group label (e.g. "12U"), or "All ages" for the org-wide summary. */
  ageGroup: string;
  playerCount: number;
  evaluatedCount: number;
  measurables: MeasurableBenchmark[];
  sliderCategories: SliderCategoryBenchmark[];
  grades: GradeCounts;
  tiers: TierBucket[];
}

export interface SeasonBenchmarks {
  generatedAt: string;
  orgName: string;
  totalPlayers: number;
  totalEvaluated: number;
  /** Org-wide summary (ageGroup === "All ages") — computed independently from
   *  the roster, not averaged from the per-group entries below, so uneven
   *  group sizes don't distort it (Simpson's-paradox style). */
  overall: AgeGroupBenchmark;
  ageGroups: AgeGroupBenchmark[];
}

function summarizeGroup(
  ageGroup: string,
  players: BenchmarkPlayerInput[],
  evaluations: BenchmarkEvaluationInput[],
  grades: BenchmarkGradeInput[],
  categories: TemplateCategory[],
): AgeGroupBenchmark {
  const playerIds = new Set(players.map(p => p.id));
  const groupEvals = evaluations.filter(e => playerIds.has(e.player_id));
  const groupGrades = grades.filter(g => playerIds.has(g.player_id));

  const agg = aggregateScoresByPlayer(groupEvals);
  const evaluatedIds = new Set(Object.keys(agg));

  const measurables: MeasurableBenchmark[] = [];
  for (const cat of categories) {
    for (const skill of cat.skills) {
      if (skill.type !== "number") continue;
      const values: number[] = [];
      for (const pid of evaluatedIds) {
        const v = agg[pid]?.[skill.id];
        if (v !== undefined && v !== null) values.push(v);
      }
      if (values.length === 0) continue;
      measurables.push({
        categoryName: cat.name,
        skillId: skill.id,
        label: skill.label,
        unit: skill.unit ?? "",
        count: values.length,
        avg: round1(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
      });
    }
  }

  const sliderCategories: SliderCategoryBenchmark[] = [];
  for (const cat of categories) {
    if (!cat.skills.some(s => s.type === "slider")) continue;
    const values: number[] = [];
    for (const pid of evaluatedIds) {
      const v = calcCategoryAvg(agg[pid] ?? {}, cat);
      if (v !== null) values.push(v);
    }
    if (values.length === 0) continue;
    sliderCategories.push({
      categoryName: cat.name,
      count: values.length,
      avg: round1(values.reduce((a, b) => a + b, 0) / values.length),
    });
  }

  const gradeCounts: GradeCounts = { offer: 0, bubble: 0, pass: 0, total: 0 };
  for (const g of groupGrades) {
    gradeCounts[g.grade]++;
    gradeCounts.total++;
  }

  const tierCounts = new Map<string, number>(SCORE_TIERS.map(t => [t.label, 0]));
  let notYetEvaluated = 0;
  for (const pid of playerIds) {
    if (!evaluatedIds.has(pid)) {
      notYetEvaluated++;
      continue;
    }
    const overall = calcSliderOverall(agg[pid] ?? {}, categories);
    const tier = scoreTier(overall);
    if (tier) tierCounts.set(tier.label, (tierCounts.get(tier.label) ?? 0) + 1);
    else notYetEvaluated++; // has a row, but no slider-scored overall yet (e.g. measurable-only categories so far)
  }
  const tiers: TierBucket[] = [
    ...SCORE_TIERS.map(t => ({ label: t.label, count: tierCounts.get(t.label) ?? 0 })),
    { label: "Not yet evaluated", count: notYetEvaluated },
  ];

  return {
    ageGroup,
    playerCount: players.length,
    evaluatedCount: evaluatedIds.size,
    measurables,
    sliderCategories,
    grades: gradeCounts,
    tiers,
  };
}

/**
 * Anonymized season benchmarks: org-wide + per-age-group averages, grade and
 * tier distributions. Contains zero player-identifying data by construction —
 * every input type here omits name/jersey/notes, and nothing in the output
 * shapes carries a player id or raw date. Safe to keep after a season purge,
 * and honest enough to publish (e.g. as blog content) without a privacy risk.
 */
export function buildSeasonBenchmarks(
  players: BenchmarkPlayerInput[],
  evaluations: BenchmarkEvaluationInput[],
  grades: BenchmarkGradeInput[],
  categories: TemplateCategory[],
  orgName: string,
): SeasonBenchmarks {
  const overall = summarizeGroup("All ages", players, evaluations, grades, categories);
  const groupLabels = sortAgeGroups([...new Set(players.map(playerAgeGroup))]);
  const ageGroups = groupLabels.map(label =>
    summarizeGroup(
      label,
      players.filter(p => playerAgeGroup(p) === label),
      evaluations,
      grades,
      categories,
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    orgName,
    totalPlayers: players.length,
    totalEvaluated: overall.evaluatedCount,
    overall,
    ageGroups,
  };
}

export function benchmarksToJson(b: SeasonBenchmarks): string {
  return JSON.stringify(b, null, 2);
}

/**
 * Bundle the Markdown + JSON into a single zip. Both are the same benchmarks,
 * one human-readable and one machine-readable — but they must ship as ONE
 * download: a single click that fires two separate downloadBlob() calls trips
 * Chrome's "multiple automatic downloads" guard, which silently drops the
 * second file (the JSON) with no error. One zip, one download, nothing lost.
 */
export async function buildSeasonBenchmarksZip(b: SeasonBenchmarks): Promise<Blob> {
  const zip = new JSZip();
  zip.file("season-benchmarks.md", benchmarksToMarkdown(b));
  zip.file("season-benchmarks.json", benchmarksToJson(b));
  return zip.generateAsync({ type: "blob" });
}

/** Human-readable Markdown — doubles as a starting draft for a "season recap" blog post. */
export function benchmarksToMarkdown(b: SeasonBenchmarks): string {
  const lines: string[] = [];
  const dateLabel = new Date(b.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  lines.push(`# ${b.orgName} — Season Benchmarks`);
  lines.push("");
  lines.push(`Generated ${dateLabel}`);
  lines.push("");
  lines.push(`**${b.totalPlayers}** players on the roster, **${b.totalEvaluated}** evaluated.`);
  lines.push("");

  const section = (g: AgeGroupBenchmark) => {
    lines.push(`## ${g.ageGroup}`);
    lines.push("");
    lines.push(`${g.playerCount} players · ${g.evaluatedCount} evaluated`);
    lines.push("");

    if (g.measurables.length > 0) {
      lines.push("| Metric | Avg | Range | N |");
      lines.push("|---|---|---|---|");
      for (const m of g.measurables) {
        const unit = m.unit ? ` ${m.unit}` : "";
        lines.push(`| ${m.categoryName}: ${m.label} | ${m.avg}${unit} | ${m.min}–${m.max}${unit} | ${m.count} |`);
      }
      lines.push("");
    }

    if (g.sliderCategories.length > 0) {
      lines.push("| Category | Avg (1–10) | N |");
      lines.push("|---|---|---|");
      for (const c of g.sliderCategories) {
        lines.push(`| ${c.categoryName} | ${c.avg} | ${c.count} |`);
      }
      lines.push("");
    }

    if (g.grades.total > 0) {
      lines.push(`**Grades:** ${g.grades.offer} offer · ${g.grades.bubble} bubble · ${g.grades.pass} pass (${g.grades.total} total)`);
      lines.push("");
    }

    const scoredTiers = g.tiers.filter(t => t.count > 0);
    if (scoredTiers.length > 0) {
      lines.push(`**Tiers:** ${scoredTiers.map(t => `${t.label} ${t.count}`).join(" · ")}`);
      lines.push("");
    }
  };

  section(b.overall);
  for (const g of b.ageGroups) section(g);

  return lines.join("\n");
}
