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
});
