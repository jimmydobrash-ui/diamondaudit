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

  it("accepts jersey numbers above 100 (tryouts can run past 99)", () => {
    const csv = [
      header,
      "Marcus,Johnson,2012-05-10,SS,R,R,150,",
      "Eli,Carter,2011-08-22,C,L,R,999,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players[0].jersey_number).toBe(150);
    expect(players[1].jersey_number).toBe(999);
  });

  it("does not reject or dedupe rows with duplicate jersey numbers", () => {
    // Two different players sharing #7 — dedupe is keyed on name+DOB, never on
    // jersey, so both should import cleanly with no duplicate-jersey error.
    const csv = [
      header,
      "Marcus,Johnson,2012-05-10,SS,R,R,7,",
      "Eli,Carter,2011-08-22,C,L,R,7,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(2);
    expect(players[0].jersey_number).toBe(7);
    expect(players[1].jersey_number).toBe(7);
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

describe("parseRosterCsv — Playbook format", () => {
  // Trimmed Playbook headers/rows — real files have ~36 columns, but only
  // participant_name, dob, class_session, and Participant player_position
  // matter for the roster. We include the surrounding fluff to prove the
  // auto-detect + column lookup work against the actual header shape.
  const playbookHeader =
    "pk,class_session,dob,participant_name,participant_age,gender,Participant former_team,Participant player_position";

  it("auto-detects Playbook and imports the fields we care about", () => {
    const csv = [
      playbookHeader,
      '1251296,Fri 07/10/26 05:00 PM - 14u 2027 Youth Team Tryouts,2012-12-01,Macklin Matter,13,ML,Team 5280,"C, RHP, 1B"',
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      first_name: "Macklin",
      last_name: "Matter",
      date_of_birth: "2012-12-01",
      positions: ["C", "P", "1B"], // RHP normalised to P
      tags: ["14U"],
      notes: "Former team: Team 5280",
    });
  });

  it("keeps compound last names together (splits on first space, not last)", () => {
    // "Laura Gomez Rios" — coach can fix via the player edit form if wrong,
    // but we default to treating everything after the first space as the last
    // name because paternal-maternal compound surnames are common enough.
    const csv = [
      playbookHeader,
      "1,Tue 07/07/26 05:00 PM - 11U 2027 Youth Team Tryouts,2015-12-12,Laura Gomez Rios,10,FM,Diamond Club,2B",
    ].join("\n");
    const { players } = parseRosterCsv(csv);
    expect(players[0].first_name).toBe("Laura");
    expect(players[0].last_name).toBe("Gomez Rios");
  });

  it("extracts the tryout age group from the class session (case-insensitive)", () => {
    const csv = [
      playbookHeader,
      "1,Wed 07/08/26 05:00 PM - 12u 2027 Youth Team Tryouts,2014-07-17,Bradley Turner,11,ML,Gameday,3B",
      "2,11U 2027 Youth Team Tryouts,2015-01-01,Sam Whitfield,10,ML,Diamond,SS",
    ].join("\n");
    const { players } = parseRosterCsv(csv);
    expect(players[0].tags).toEqual(["12U"]);
    expect(players[1].tags).toEqual(["11U"]);
  });

  it("dedupes Playbook rows within the file and against the existing roster", () => {
    const existing = rosterDedupeKeys([
      { first_name: "Macklin", last_name: "Matter", date_of_birth: "2012-12-01" },
    ]);
    const csv = [
      playbookHeader,
      "1,14u,2012-12-01,Macklin Matter,13,ML,,C",
      "2,13u,2014-02-15,Nolan Foncannon,12,ML,,3B",
      "3,13u,2014-02-15,Nolan Foncannon,12,ML,,3B", // in-file dup
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv, existing);
    expect(players.map(p => `${p.first_name} ${p.last_name}`)).toEqual(["Nolan Foncannon"]);
    expect(errors.some(e => /already on the roster/.test(e))).toBe(true);
    expect(errors.some(e => /appears twice in the file/.test(e))).toBe(true);
  });

  it("handles Playbook rows with missing optional fields (no position, no team)", () => {
    const csv = [
      playbookHeader,
      "1,10U tryouts,2016-04-10,Gabe Rivera,9,ML,,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players[0].positions).toEqual([]);
    expect(players[0].notes).toBe("");
    expect(players[0].tags).toEqual(["10U"]);
  });

  it("reports missing dob / participant_name with the file row number", () => {
    const csv = [
      playbookHeader,
      "1,14u,,Macklin Matter,13,ML,,",
      "2,14u,2012-01-01,,13,ML,,",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(players).toEqual([]);
    expect(errors).toEqual([
      "Row 2: Missing dob for Macklin Matter",
      "Row 3: Missing participant_name",
    ]);
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
