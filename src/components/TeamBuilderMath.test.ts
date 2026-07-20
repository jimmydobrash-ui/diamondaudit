import { describe, it, expect } from "vitest";
import {
  compareByScoreThenName,
  sortByScoreThenName,
  computeRosterMath,
  positionCounts,
  offerListCsv,
  type RosterPlayer,
} from "./TeamBuilderMath";

const mk = (over: Partial<RosterPlayer> & { id: string }): RosterPlayer => ({
  first_name: "First",
  last_name: "Last",
  jersey_number: null,
  positions: [],
  date_of_birth: "2013-01-01",
  tags: null,
  ...over,
});

describe("compareByScoreThenName", () => {
  const scores: Record<string, number> = { a: 8.5, b: 6, c: 8.5 };
  const scoreOf = (id: string) => scores[id];

  it("orders higher overall first", () => {
    const a = mk({ id: "a", last_name: "Alpha" });
    const b = mk({ id: "b", last_name: "Bravo" });
    expect(compareByScoreThenName(a, b, scoreOf)).toBeLessThan(0);
    expect(compareByScoreThenName(b, a, scoreOf)).toBeGreaterThan(0);
  });

  it("puts evaluated players before unevaluated ones", () => {
    const evaluated = mk({ id: "b", last_name: "Aaa" }); // score 6
    const unevaluated = mk({ id: "z", last_name: "Aaa" }); // no score
    expect(compareByScoreThenName(evaluated, unevaluated, scoreOf)).toBeLessThan(0);
    expect(compareByScoreThenName(unevaluated, evaluated, scoreOf)).toBeGreaterThan(0);
  });

  it("breaks equal-score ties alphabetically", () => {
    const a = mk({ id: "a", last_name: "Ames", first_name: "Zoe" }); // 8.5
    const c = mk({ id: "c", last_name: "Carter", first_name: "Al" }); // 8.5
    expect(compareByScoreThenName(a, c, scoreOf)).toBeLessThan(0);
  });

  it("sorts two unevaluated players alphabetically", () => {
    const carter = mk({ id: "y", last_name: "Carter" });
    const ames = mk({ id: "z", last_name: "Ames" });
    expect(compareByScoreThenName(carter, ames, scoreOf)).toBeGreaterThan(0);
  });

  it("treats a 0 overall as unevaluated", () => {
    const zero = mk({ id: "0", last_name: "Aaa" });
    const scored = mk({ id: "b", last_name: "Zzz" }); // 6
    const withZero = (id: string) => (id === "0" ? 0 : scores[id]);
    expect(compareByScoreThenName(zero, scored, withZero)).toBeGreaterThan(0);
  });

  it("produces a full ranked-then-alphabetical ordering", () => {
    const players = [
      mk({ id: "z1", last_name: "Ng" }), // unevaluated
      mk({ id: "a", last_name: "Alpha" }), // 8.5
      mk({ id: "z2", last_name: "Diaz" }), // unevaluated
      mk({ id: "b", last_name: "Bravo" }), // 6
      mk({ id: "c", last_name: "Carter", first_name: "Al" }), // 8.5
    ];
    const order = sortByScoreThenName(players, scoreOf).map(p => p.last_name);
    expect(order).toEqual(["Alpha", "Carter", "Bravo", "Diaz", "Ng"]);
  });
});

describe("computeRosterMath", () => {
  it("reports open spots when under target", () => {
    expect(computeRosterMath(9, 5, 12)).toEqual({ offered: 9, target: 12, bubble: 5, open: 3, over: 0 });
  });

  it("reports zero open and the overage when past target", () => {
    expect(computeRosterMath(14, 2, 12)).toEqual({ offered: 14, target: 12, bubble: 2, open: 0, over: 2 });
  });

  it("is exactly full at target", () => {
    const m = computeRosterMath(12, 0, 12);
    expect(m.open).toBe(0);
    expect(m.over).toBe(0);
  });
});

describe("positionCounts", () => {
  it("counts every position a player lists (multi-position players count twice)", () => {
    const players = [
      mk({ id: "1", positions: ["SS", "P"] }),
      mk({ id: "2", positions: ["P"] }),
      mk({ id: "3", positions: ["C"] }),
      mk({ id: "4", positions: ["OF", "P"] }),
    ];
    const counts = positionCounts(players);
    const map = Object.fromEntries(counts.map(c => [c.position, c.count]));
    expect(map).toEqual({ P: 3, C: 1, SS: 1, OF: 1 });
  });

  it("orders by the defensive spectrum, unknown labels last", () => {
    const players = [mk({ id: "1", positions: ["OF", "C", "SS", "P", "ROVER"] })];
    expect(positionCounts(players).map(c => c.position)).toEqual(["P", "C", "SS", "OF", "ROVER"]);
  });

  it("ignores blank/whitespace positions", () => {
    const players = [mk({ id: "1", positions: ["P", "", "  "] })];
    expect(positionCounts(players)).toEqual([{ position: "P", count: 1 }]);
  });
});

describe("offerListCsv", () => {
  // Explicit NNU tags keep the Age Group column deterministic (not DOB/date-relative).
  const players: RosterPlayer[] = [
    mk({ id: "a", first_name: "Marcus", last_name: "Johnson", jersey_number: 7, positions: ["SS", "P"], tags: ["12U"] }),
    mk({ id: "b", first_name: "Aiden", last_name: "Brown", jersey_number: 9, positions: ["OF"], tags: ["10U"] }),
    mk({ id: "c", first_name: "Noah", last_name: "Garcia", jersey_number: 14, positions: ["C"], tags: ["12U"] }),
  ];
  const scoreMap: Record<string, number> = { a: 8.2, b: 7.1, c: 9 };
  const scoreOf = (id: string) => scoreMap[id];

  it("emits the documented header row", () => {
    const csv = offerListCsv(players, scoreOf);
    expect(csv.split("\r\n")[0]).toBe("Jersey,First Name,Last Name,Age Group,Positions,Overall");
  });

  it("orders youngest age group first, then highest overall", () => {
    const lines = offerListCsv(players, scoreOf).split("\r\n").slice(1);
    // 10U Brown first, then 12U Garcia (9) above 12U Johnson (8.2)
    expect(lines.map(l => l.split(",")[2])).toEqual(["Brown", "Garcia", "Johnson"]);
  });

  it("includes age group, joined positions, and overall", () => {
    const line = offerListCsv(players, scoreOf).split("\r\n").find(l => l.includes("Johnson"));
    expect(line).toBe("7,Marcus,Johnson,12U,SS / P,8.2");
  });

  it("routes through toCsv's escaping (comma-bearing name is quoted)", () => {
    const csv = offerListCsv([mk({ id: "x", first_name: "John", last_name: "Doe, Jr", jersey_number: 1 })], () => 5);
    expect(csv).toContain('"Doe, Jr"');
  });

  it("leaves an unevaluated player's overall blank", () => {
    const csv = offerListCsv(
      [mk({ id: "x", first_name: "No", last_name: "Score", jersey_number: 2, tags: ["11U"] })],
      () => undefined,
    );
    expect(csv.split("\r\n")[1]).toBe("2,No,Score,11U,,"); // no positions, no overall
  });
});
