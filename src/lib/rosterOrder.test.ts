import { describe, it, expect } from "vitest";
import { compareForTryout, numericAgeGroup, type OrderablePlayer } from "./rosterOrder";

// A DOB that lands well inside a young group, overridden by tags where noted.
const mk = (over: Partial<OrderablePlayer>): OrderablePlayer => ({
  date_of_birth: "2014-01-01",
  tags: null,
  jersey_number: null,
  last_name: "Zulu",
  ...over,
});

describe("numericAgeGroup", () => {
  it("reads the numeric prefix from a tag override", () => {
    expect(numericAgeGroup(mk({ tags: ["14U"] }))).toBe(14);
    expect(numericAgeGroup(mk({ tags: ["Top Prospect", "9U"] }))).toBe(9);
  });

  it("falls back to the DOB-derived group when no tag", () => {
    // exact number is date-relative; just assert it's a finite number
    expect(Number.isFinite(numericAgeGroup(mk({})))).toBe(true);
  });
});

describe("compareForTryout", () => {
  it("orders younger age groups before older ones", () => {
    const younger = mk({ tags: ["10U"], jersey_number: 99 });
    const older = mk({ tags: ["12U"], jersey_number: 1 });
    expect(compareForTryout(younger, older)).toBeLessThan(0);
  });

  it("within a group, sorts by jersey number ascending", () => {
    const g = ["12U"];
    const a = mk({ tags: g, jersey_number: 3 });
    const b = mk({ tags: g, jersey_number: 12 });
    expect(compareForTryout(a, b)).toBeLessThan(0);
    expect(compareForTryout(b, a)).toBeGreaterThan(0);
  });

  it("puts players without a jersey number last within a group", () => {
    const g = ["12U"];
    const numbered = mk({ tags: g, jersey_number: 50 });
    const unnumbered = mk({ tags: g, jersey_number: null });
    expect(compareForTryout(numbered, unnumbered)).toBeLessThan(0);
    expect(compareForTryout(unnumbered, numbered)).toBeGreaterThan(0);
  });

  it("breaks ties (same group, both un-numbered) by last name", () => {
    const g = ["12U"];
    const carter = mk({ tags: g, jersey_number: null, last_name: "Carter" });
    const johnson = mk({ tags: g, jersey_number: null, last_name: "Johnson" });
    expect(compareForTryout(carter, johnson)).toBeLessThan(0);
  });

  it("produces a stable full ordering", () => {
    const players = [
      mk({ tags: ["12U"], jersey_number: null, last_name: "Ng" }),
      mk({ tags: ["10U"], jersey_number: 7, last_name: "Ruiz" }),
      mk({ tags: ["12U"], jersey_number: 4, last_name: "Ames" }),
      mk({ tags: ["10U"], jersey_number: null, last_name: "Diaz" }),
      mk({ tags: ["12U"], jersey_number: 4, last_name: "Ackermann" }),
    ];
    const order = [...players].sort(compareForTryout).map(p => `${numericAgeGroup(p)}/${p.jersey_number ?? "-"}/${p.last_name}`);
    expect(order).toEqual([
      "10/7/Ruiz",
      "10/-/Diaz",
      "12/4/Ackermann", // jersey tie -> last name
      "12/4/Ames",
      "12/-/Ng",
    ]);
  });
});
