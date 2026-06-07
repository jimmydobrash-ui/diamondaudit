import { describe, it, expect } from "vitest";
import {
  aggregateScoresByPlayer,
  calcSliderOverall,
  calcCategoryAvg,
  visibleEvalCategories,
} from "./scoring";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

const categories: TemplateCategory[] = [
  {
    id: "hitting",
    name: "Hitting",
    skills: [
      { id: "contact", label: "Contact", type: "slider" },
      { id: "power", label: "Power", type: "slider" },
      { id: "exitVelo", label: "Exit Velo", type: "number", unit: "mph" },
    ],
  },
  {
    id: "catching",
    name: "Catching",
    skills: [
      { id: "popTime", label: "Pop Time", type: "slider" },
      { id: "blocking", label: "Blocking", type: "slider" },
    ],
  },
];

describe("aggregateScoresByPlayer", () => {
  it("averages each skill across evaluations (per-skill, rounded to 1 dp)", () => {
    const result = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8, power: 6 } },
      { player_id: "p1", scores: { contact: 7, power: 7 } },
    ]);
    // contact (8+7)/2 = 7.5, power (6+7)/2 = 6.5
    expect(result.p1).toEqual({ contact: 7.5, power: 6.5 });
  });

  it("returns a single evaluation's scores unchanged (one coach)", () => {
    const result = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8, power: 6, exitVelo: 90 } },
    ]);
    expect(result.p1).toEqual({ contact: 8, power: 6, exitVelo: 90 });
  });

  it("averages a skill only over the evaluations that scored it", () => {
    const result = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8 } },
      { player_id: "p1", scores: { contact: 6, power: 9 } },
    ]);
    // contact (8+6)/2 = 7; power only scored once -> 9
    expect(result.p1).toEqual({ contact: 7, power: 9 });
  });

  it("buckets players separately", () => {
    const result = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8 } },
      { player_id: "p2", scores: { contact: 4 } },
    ]);
    expect(result).toEqual({ p1: { contact: 8 }, p2: { contact: 4 } });
  });

  it("ignores null/undefined skill values", () => {
    const result = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8, power: null as unknown as number } },
      { player_id: "p1", scores: { contact: 6 } },
    ]);
    expect(result.p1).toEqual({ contact: 7 });
  });

  it("returns an empty object for no evaluations", () => {
    expect(aggregateScoresByPlayer([])).toEqual({});
  });

  it("feeds calcSliderOverall so multi-coach overalls are consistent", () => {
    // Two coaches: aggregate per-skill first, then slider overall.
    const agg = aggregateScoresByPlayer([
      { player_id: "p1", scores: { contact: 8, power: 6, exitVelo: 90 } },
      { player_id: "p1", scores: { contact: 6, power: 8, exitVelo: 80 } },
    ]);
    // aggregated sliders: contact 7, power 7 -> overall (7+7)/2 = 7 (exitVelo excluded)
    expect(calcSliderOverall(agg.p1, categories)).toBe(7);
  });
});

describe("calcSliderOverall", () => {
  it("averages slider skills only, excluding number skills", () => {
    // exitVelo (90, a number skill) must be excluded: (8 + 6 + 7 + 5) / 4 = 6.5
    const scores = { contact: 8, power: 6, exitVelo: 90, popTime: 7, blocking: 5 };
    expect(calcSliderOverall(scores, categories)).toBe(6.5);
  });

  it("ignores score keys not present in any category template", () => {
    // staleSkill is not in the template, so it is dropped: (8 + 6) / 2 = 7
    const scores = { contact: 8, power: 6, staleSkill: 1 };
    expect(calcSliderOverall(scores, categories)).toBe(7);
  });

  it("returns 0 when no slider skills were scored", () => {
    expect(calcSliderOverall({ exitVelo: 90 }, categories)).toBe(0);
    expect(calcSliderOverall({}, categories)).toBe(0);
  });
});

describe("calcCategoryAvg", () => {
  it("averages slider skills within the category", () => {
    // hitting sliders: (8 + 6) / 2 = 7; exitVelo excluded
    const scores = { contact: 8, power: 6, exitVelo: 90 };
    expect(calcCategoryAvg(scores, categories[0])).toBe(7);
  });

  it("returns null when no slider skills in the category were scored", () => {
    // only the number skill was scored for the hitting category
    expect(calcCategoryAvg({ exitVelo: 90 }, categories[0])).toBeNull();
    expect(calcCategoryAvg({}, categories[1])).toBeNull();
  });

  it("averages only the skills that were actually scored", () => {
    // only popTime present in catching: avg = 7
    expect(calcCategoryAvg({ popTime: 7 }, categories[1])).toBe(7);
  });
});

describe("visibleEvalCategories", () => {
  it("shows all categories for a catcher", () => {
    expect(visibleEvalCategories(categories, ["C", "1B"])).toHaveLength(2);
  });

  it("hides catching for a non-catcher with positions set", () => {
    const visible = visibleEvalCategories(categories, ["SS", "2B"]);
    expect(visible.map(c => c.id)).toEqual(["hitting"]);
  });

  it("shows all categories when positions are empty", () => {
    expect(visibleEvalCategories(categories, [])).toHaveLength(2);
  });

  it("shows all categories when positions are null or undefined", () => {
    expect(visibleEvalCategories(categories, null)).toHaveLength(2);
    expect(visibleEvalCategories(categories, undefined)).toHaveLength(2);
  });
});
