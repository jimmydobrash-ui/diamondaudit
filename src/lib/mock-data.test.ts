import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getPlayingAge, getAgeGroup, playerAgeGroup, sortAgeGroups } from "./mock-data";

// Playing age is computed against May 1 of the *current* year, so pin the clock
// to make the tests deterministic. Mid-month birth dates are used throughout to
// avoid timezone-boundary shifts when parsing the ISO date strings.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 6, 12, 0, 0)); // 2026-06-06 local noon
});

afterAll(() => {
  vi.useRealTimers();
});

describe("getPlayingAge", () => {
  it("counts a full year for a player born before the May 1 cutoff", () => {
    // born March 2012 -> has turned 14 by 2026-05-01
    expect(getPlayingAge("2012-03-15")).toBe(14);
  });

  it("subtracts a year for a player born after the May 1 cutoff", () => {
    // born August 2012 -> only 13 as of 2026-05-01
    expect(getPlayingAge("2012-08-22")).toBe(13);
    // born June 2014 -> 11 as of 2026-05-01
    expect(getPlayingAge("2014-06-15")).toBe(11);
  });
});

describe("getAgeGroup", () => {
  it("formats the playing age with a 'U' suffix", () => {
    expect(getAgeGroup("2012-03-15")).toBe("14U");
    expect(getAgeGroup("2012-08-22")).toBe("13U");
    expect(getAgeGroup("2014-06-15")).toBe("11U");
  });
});

describe("playerAgeGroup", () => {
  it("prefers a `NNU` tag over the DOB-derived age (playing up)", () => {
    // 13U by DOB, but registered to play up to 14U — the tag wins.
    expect(playerAgeGroup({ date_of_birth: "2012-08-22", tags: ["14U"] })).toBe("14U");
  });

  it("falls back to DOB-derived age when no age tag is present", () => {
    expect(playerAgeGroup({ date_of_birth: "2012-08-22", tags: [] })).toBe("13U");
    expect(playerAgeGroup({ date_of_birth: "2012-03-15", tags: ["Top Prospect"] })).toBe("14U");
  });

  it("ignores non-age tags when picking the override", () => {
    // Top Prospect should not be interpreted as an age group.
    expect(playerAgeGroup({ date_of_birth: "2012-08-22", tags: ["Top Prospect", "10U"] })).toBe("10U");
  });

  it("handles null tags (defensive against DB nulls)", () => {
    expect(playerAgeGroup({ date_of_birth: "2012-08-22", tags: null })).toBe("13U");
  });
});

describe("sortAgeGroups", () => {
  it("sorts numerically, not lexicographically", () => {
    // Before: string sort produced ['10U','11U','12U','13U','7U','8U','9U']
    expect(sortAgeGroups(["10U", "12U", "7U", "14U", "8U", "11U", "9U", "13U"])).toEqual([
      "7U", "8U", "9U", "10U", "11U", "12U", "13U", "14U",
    ]);
  });

  it("returns a new array (doesn't mutate the input)", () => {
    const input = ["14U", "10U", "8U"];
    const output = sortAgeGroups(input);
    expect(input).toEqual(["14U", "10U", "8U"]);
    expect(output).toEqual(["8U", "10U", "14U"]);
  });

  it("puts non-numeric labels after numeric ones", () => {
    expect(sortAgeGroups(["14U", "unknown", "8U"])).toEqual(["8U", "14U", "unknown"]);
  });
});
