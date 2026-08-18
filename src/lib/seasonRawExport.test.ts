import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { playersToCsv, evaluationsToCsv, gradesToCsv, buildSeasonRawExportZip } from "./seasonRawExport";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";
import type { Player } from "@/hooks/usePlayers";
import type { Evaluation } from "@/hooks/useEvaluations";
import type { PlayerGrade } from "@/hooks/usePlayerGrades";

function mockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    organization_id: "org1",
    first_name: "Jackson",
    last_name: "Kaye",
    date_of_birth: "2012-01-01",
    positions: ["SS"],
    bats: "R",
    throws: "R",
    height: "5'6\"",
    weight: 130,
    jersey_number: 7,
    notes: "",
    tags: ["10U"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: "e1",
    organization_id: "org1",
    player_id: "p1",
    coach_id: "coach1",
    event_id: null,
    scores: { contact: 8 },
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Evaluation;
}

function mockGrade(overrides: Partial<PlayerGrade> = {}): PlayerGrade {
  return {
    id: "g1",
    player_id: "p1",
    coach_id: "coach1",
    organization_id: "org1",
    grade: "offer",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const playerLookups = [{ id: "p1", first_name: "Jackson", last_name: "Kaye", date_of_birth: "2012-01-01", tags: ["10U"] }];
const categories: TemplateCategory[] = [
  { id: "hitting", name: "Hitting", skills: [{ id: "contact", label: "Contact", type: "slider" }] },
];

describe("playersToCsv", () => {
  it("includes every roster field plus a derived age group", () => {
    const csv = playersToCsv([mockPlayer()]);
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("Age Group");
    expect(row).toContain("Jackson");
    expect(row).toContain("Kaye");
    expect(row).toContain("10U"); // derived from the tag
  });
});

describe("evaluationsToCsv", () => {
  it("produces one row per raw (unaggregated) evaluation, not a cross-coach average", () => {
    const evals = [
      mockEvaluation({ id: "e1", coach_id: "c1", scores: { contact: 8 } }),
      mockEvaluation({ id: "e2", coach_id: "c2", scores: { contact: 6 } }),
    ];
    const csv = evaluationsToCsv(evals, categories, playerLookups, { c1: "Coach A", c2: "Coach B" });
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2 rows, no averaging
  });

  it("labels known skill columns as 'Category: Skill (unit)'", () => {
    const csv = evaluationsToCsv([mockEvaluation()], categories, playerLookups, {});
    expect(csv.split("\r\n")[0]).toContain("Hitting: Contact");
  });

  it("appends a trailing column for a skill id no longer in the current template", () => {
    const evals = [mockEvaluation({ scores: { contact: 8, oldSkill: 5 } })];
    const csv = evaluationsToCsv(evals, categories, playerLookups, {});
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("(removed skill) oldSkill");
    expect(row).toContain("5");
  });

  it("falls back to 'Coach' when a coach id has no name mapping", () => {
    const csv = evaluationsToCsv([mockEvaluation({ coach_id: "unknown" })], categories, playerLookups, {});
    expect(csv).toContain("Coach");
  });
});

describe("gradesToCsv", () => {
  it("includes every coach's individual grade, not just offers", () => {
    const grades = [
      mockGrade({ id: "g1", coach_id: "c1", grade: "offer" }),
      mockGrade({ id: "g2", coach_id: "c2", grade: "pass" }),
    ];
    const csv = gradesToCsv(grades, playerLookups, { c1: "Coach A", c2: "Coach B" });
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2 rows
    expect(csv).toContain("offer");
    expect(csv).toContain("pass");
  });
});

describe("buildSeasonRawExportZip", () => {
  it("bundles players.csv, evaluations.csv, player_grades.csv, and a README", async () => {
    const blob = await buildSeasonRawExportZip({
      orgName: "Test Org",
      players: [mockPlayer()],
      evaluations: [mockEvaluation()],
      grades: [mockGrade()],
      categories,
      coachNameById: {},
    });
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files).sort()).toEqual([
      "README.txt",
      "evaluations.csv",
      "player_grades.csv",
      "players.csv",
    ]);
  });
});
