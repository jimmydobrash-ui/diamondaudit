import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getPlayingAge, getAgeGroup } from "./mock-data";

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
