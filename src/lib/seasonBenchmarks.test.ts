import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildSeasonBenchmarks,
  benchmarksToJson,
  benchmarksToMarkdown,
  buildSeasonBenchmarksZip,
  type BenchmarkPlayerInput,
  type BenchmarkEvaluationInput,
  type BenchmarkGradeInput,
} from "./seasonBenchmarks";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

const categories: TemplateCategory[] = [
  {
    id: "hitting",
    name: "Hitting",
    skills: [
      { id: "contact", label: "Contact", type: "slider" },
      { id: "exitVelo", label: "Exit Velo", type: "number", unit: "mph" },
    ],
  },
];

// Explicit "NNU" tags rather than date-of-birth-derived age groups, so this
// fixture stays correct regardless of what "today" is when the test runs.
const players: BenchmarkPlayerInput[] = [
  { id: "p1", date_of_birth: "2012-01-01", tags: ["10U"] },
  { id: "p2", date_of_birth: "2012-06-01", tags: ["10U"] },
  { id: "p3", date_of_birth: "2010-01-01", tags: ["12U"] },
];

const evaluations: BenchmarkEvaluationInput[] = [
  // p1 scored by two coaches -> aggregated contact (8+6)/2=7, exitVelo (70+74)/2=72
  { player_id: "p1", scores: { contact: 8, exitVelo: 70 } },
  { player_id: "p1", scores: { contact: 6, exitVelo: 74 } },
  { player_id: "p2", scores: { contact: 6, exitVelo: 60 } },
  { player_id: "p3", scores: { contact: 9, exitVelo: 90 } },
];

const grades: BenchmarkGradeInput[] = [
  { player_id: "p1", grade: "offer" },
  { player_id: "p2", grade: "bubble" },
  { player_id: "p3", grade: "offer" },
];

describe("buildSeasonBenchmarks", () => {
  it("computes org-wide totals", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    expect(b.orgName).toBe("Test Org");
    expect(b.totalPlayers).toBe(3);
    expect(b.totalEvaluated).toBe(3);
  });

  it("groups age groups by the explicit tag, sorted numerically", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    expect(b.ageGroups.map(g => g.ageGroup)).toEqual(["10U", "12U"]);
  });

  it("averages a measurable across evaluated players within a group", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const g10 = b.ageGroups.find(g => g.ageGroup === "10U")!;
    // p1 exitVelo agg = 72, p2 = 60 -> avg 66, min 60, max 72
    const exitVelo = g10.measurables.find(m => m.skillId === "exitVelo")!;
    expect(exitVelo).toMatchObject({ avg: 66, min: 60, max: 72, count: 2 });
  });

  it("averages a slider category the same way as calcCategoryAvg per player, then across players", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const g10 = b.ageGroups.find(g => g.ageGroup === "10U")!;
    // p1 contact agg = 7, p2 contact = 6 -> avg 6.5
    const hitting = g10.sliderCategories.find(c => c.categoryName === "Hitting")!;
    expect(hitting).toMatchObject({ avg: 6.5, count: 2 });
  });

  it("counts grades per coach-grade-row, not resolved to one grade per player", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const g10 = b.ageGroups.find(g => g.ageGroup === "10U")!;
    expect(g10.grades).toEqual({ offer: 1, bubble: 1, pass: 0, total: 2 });
  });

  it("buckets each evaluated player into a tier by their overall", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const g10 = b.ageGroups.find(g => g.ageGroup === "10U")!;
    // p1 overall = 7 (only slider skill is contact) -> "Above Average"; p2 = 6 -> "Average"
    const withCounts = g10.tiers.filter(t => t.count > 0);
    expect(withCounts).toEqual(
      expect.arrayContaining([
        { label: "Above Average", count: 1 },
        { label: "Average", count: 1 },
      ]),
    );
  });

  it("computes the org-wide summary independently, not as an average of the group averages", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    // exitVelo across all 3: [72, 60, 90] -> avg 74
    const exitVelo = b.overall.measurables.find(m => m.skillId === "exitVelo")!;
    expect(exitVelo).toMatchObject({ avg: 74, min: 60, max: 90, count: 3 });
  });

  it("counts an unevaluated player toward playerCount but not evaluatedCount or any tier", () => {
    const withUnevaluated = [...players, { id: "p4", date_of_birth: "2012-01-01", tags: ["10U"] }];
    const b = buildSeasonBenchmarks(withUnevaluated, evaluations, grades, categories, "Test Org");
    const g10 = b.ageGroups.find(g => g.ageGroup === "10U")!;
    expect(g10.playerCount).toBe(3);
    expect(g10.evaluatedCount).toBe(2);
    expect(g10.tiers.find(t => t.label === "Not yet evaluated")?.count).toBe(1);
  });
});

describe("buildSeasonBenchmarksZip", () => {
  it("bundles the markdown and json into a single zip (so the second download can't be blocked)", async () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const blob = await buildSeasonBenchmarksZip(b);
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files).sort()).toEqual(["season-benchmarks.json", "season-benchmarks.md"]);
    // The zipped contents match the standalone formatters exactly.
    expect(await zip.file("season-benchmarks.md")!.async("string")).toBe(benchmarksToMarkdown(b));
    expect(await zip.file("season-benchmarks.json")!.async("string")).toBe(benchmarksToJson(b));
  });
});

describe("buildSeasonBenchmarks — PII absence", () => {
  it("never includes a player id or date of birth in the JSON or Markdown output", () => {
    const b = buildSeasonBenchmarks(players, evaluations, grades, categories, "Test Org");
    const json = benchmarksToJson(b);
    const md = benchmarksToMarkdown(b);
    for (const p of players) {
      expect(json).not.toContain(p.id);
      expect(json).not.toContain(p.date_of_birth);
      expect(md).not.toContain(p.id);
      expect(md).not.toContain(p.date_of_birth);
    }
  });
});
