import { describe, it, expect } from "vitest";
import { parseRosterCsv, rosterDedupeKeys, splitCsvLine } from "./csvImport";

describe("splitCsvLine (RFC-4180-ish)", () => {
  it("splits a simple unquoted line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("preserves commas inside quoted fields", () => {
    // The bug from the previous parser: a comma in `notes` shifted later columns
    expect(splitCsvLine('Smith,John,"good glove, needs bat",CF')).toEqual([
      "Smith",
      "John",
      "good glove, needs bat",
      "CF",
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(splitCsvLine('a,"he said ""hi""",b')).toEqual(["a", 'he said "hi"', "b"]);
  });

  it("trims surrounding whitespace from each field", () => {
    expect(splitCsvLine(" a , b ,  c")).toEqual(["a", "b", "c"]);
  });

  it("emits a trailing empty field for a trailing comma", () => {
    expect(splitCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("parseRosterCsv", () => {
  const header = "first_name,last_name,date_of_birth,positions,bats,throws,jersey_number,notes";

  it("parses a clean roster", () => {
    const csv = [
      header,
      "Marcus,Johnson,2012-05-10,SS/P,R,R,7,",
      "Eli,Carter,2011-08-22,C;1B,L,R,23,strong arm",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(2);
    expect(players[0].first_name).toBe("Marcus");
    expect(players[0].positions).toEqual(["SS", "P"]);
    expect(players[0].jersey_number).toBe(7);
    expect(players[1].positions).toEqual(["C", "1B"]);
  });

  it("does NOT corrupt later columns when a field contains a comma", () => {
    // Regression for the original `.split(",")` parser, where the comma in
    // `notes` would push `bats`/`throws` into the wrong slot and the row would
    // either error or silently mis-map.
    const csv = [
      header,
      'Wobby,Bitt,2014-04-01,P,R,R,7,"good glove, needs bat"',
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players[0]).toMatchObject({
      first_name: "Wobby",
      bats: "R",
      throws: "R",
      jersey_number: 7,
      notes: "good glove, needs bat",
    });
  });

  it("accepts common header aliases (firstName, dob, pos, jersey, etc.)", () => {
    const csv = [
      "firstName,lastName,dob,pos,bat,throw,jersey,note",
      "Sam,Whitfield,2013-01-15,OF,R,R,15,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(1);
    expect(players[0].positions).toEqual(["OF"]);
    expect(players[0].jersey_number).toBe(15);
  });

  it("rejects rows missing a name or DOB and reports the file row number", () => {
    const csv = [
      header,
      ",Johnson,2012-05-10,,,,,",
      "Eli,,2011-08-22,,,,,",
      "Marcus,Johnson,,SS,,,,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(players).toEqual([]);
    expect(errors).toEqual([
      "Row 2: Missing name",
      "Row 3: Missing name",
      "Row 4: Missing date of birth for Marcus Johnson",
    ]);
  });

  it("rejects invalid dates", () => {
    const csv = [header, "Marcus,Johnson,not-a-date,SS,R,R,7,"].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(players).toEqual([]);
    expect(errors[0]).toMatch(/Row 2: Invalid date "not-a-date"/);
  });

  it("dedupes within the file (same name+DOB twice)", () => {
    const csv = [
      header,
      "Marcus,Johnson,2012-05-10,SS,R,R,7,",
      "Marcus,Johnson,2012-05-10,2B,R,R,7,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(players).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 3: Marcus Johnson .* appears twice in the file/);
  });

  it("dedupes against the existing roster", () => {
    const existing = rosterDedupeKeys([
      { first_name: "Marcus", last_name: "Johnson", date_of_birth: "2012-05-10" },
    ]);
    const csv = [
      header,
      "Marcus,Johnson,2012-05-10,SS,R,R,7,",
      "Eli,Carter,2011-08-22,C,L,R,23,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv, existing);
    expect(players.map(p => p.first_name)).toEqual(["Eli"]);
    expect(errors[0]).toMatch(/already on the roster/);
  });

  it("strips a UTF-8 BOM (Excel exports often add one)", () => {
    const csv = "\uFEFF" + [header, "Marcus,Johnson,2012-05-10,SS,R,R,7,"].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const csv = [header, "Marcus,Johnson,2012-05-10,SS,R,R,7,"].join("\r\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(1);
  });

  it("skips blank lines without error", () => {
    const csv = [
      header,
      "",
      "Marcus,Johnson,2012-05-10,SS,R,R,7,",
      "",
      "Eli,Carter,2011-08-22,C,L,R,23,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(2);
  });

  it("returns a clear error when first_name/last_name columns are missing", () => {
    const csv = ["dob,pos", "2012-05-10,SS"].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(players).toEqual([]);
    expect(errors[0]).toMatch(/'first_name' and 'last_name'/);
  });

  it("returns a clear error when the file has no data rows", () => {
    expect(parseRosterCsv(header).errors[0]).toMatch(/header row and at least one data row/);
  });

  it("defaults invalid bats/throws to R", () => {
    const csv = [header, "Marcus,Johnson,2012-05-10,SS,Z,Q,7,"].join("\n");
    const { players } = parseRosterCsv(csv);
    expect(players[0].bats).toBe("R");
    expect(players[0].throws).toBe("R");
  });

  it("accepts L/R/S for bats and L/R for throws (case-insensitive)", () => {
    const csv = [header, "Marcus,Johnson,2012-05-10,SS,l,r,7,"].join("\n");
    const { players } = parseRosterCsv(csv);
    expect(players[0].bats).toBe("L");
    expect(players[0].throws).toBe("R");
  });
});

describe("rosterDedupeKeys", () => {
  it("skips players without a DOB (they can't be uniquely matched)", () => {
    const keys = rosterDedupeKeys([
      { first_name: "A", last_name: "B", date_of_birth: null },
      { first_name: "C", last_name: "D", date_of_birth: "2012-01-01" },
    ]);
    expect(keys.size).toBe(1);
  });

  it("lowercases names so case differences still dedupe", () => {
    const keys = rosterDedupeKeys([
      { first_name: "Marcus", last_name: "Johnson", date_of_birth: "2012-05-10" },
    ]);
    const csv = [
      "first_name,last_name,date_of_birth",
      "MARCUS,johnson,2012-05-10",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv, keys);
    expect(players).toEqual([]);
    expect(errors[0]).toMatch(/already on the roster/);
  });
});
