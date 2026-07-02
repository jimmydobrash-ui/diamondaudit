import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, 2], [3, 4]])).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(toCsv(["name"], [["Doe, John"]])).toBe('name\r\n"Doe, John"');
    expect(toCsv(["q"], [['a "b" c']])).toBe('q\r\n"a ""b"" c"');
    expect(toCsv(["n"], [["line1\nline2"]])).toBe('n\r\n"line1\nline2"');
  });

  it("renders null/undefined as empty cells", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, ""]])).toBe("a,b,c\r\n,,");
  });

  it("neutralizes formula-injection payloads in string cells", () => {
    // Leading @, +, - would be executed by Excel/Sheets; prefix with an apostrophe.
    expect(toCsv(["name"], [["@SUM(A1:A9)"]])).toBe("name\r\n'@SUM(A1:A9)");
    expect(toCsv(["name"], [["+1-800-EVIL"]])).toBe("name\r\n'+1-800-EVIL");
    expect(toCsv(["name"], [["-2+3"]])).toBe("name\r\n'-2+3");
    // A leading = plus embedded quotes: apostrophe-prefixed, then whole cell
    // quoted because it contains ".
    expect(toCsv(["name"], [['=HYPERLINK("http://evil")']])).toBe(
      "name\r\n\"'=HYPERLINK(\"\"http://evil\"\")\"",
    );
  });

  it("does NOT prefix numeric cells (legit negatives stay intact)", () => {
    expect(toCsv(["score"], [[-5]])).toBe("score\r\n-5");
    expect(toCsv(["score"], [[7.5]])).toBe("score\r\n7.5");
  });

  it("leaves ordinary text untouched", () => {
    expect(toCsv(["name"], [["Marcus Johnson"]])).toBe("name\r\nMarcus Johnson");
  });
});
