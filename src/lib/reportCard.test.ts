import { describe, it, expect } from "vitest";
import { reportFileName, bulkReportFileName } from "./reportCard";

const player = { first_name: "Jackson", last_name: "Kaye", jersey_number: 6 };
const noJersey = { first_name: "Eli", last_name: "Carter", jersey_number: null };

describe("reportFileName", () => {
  it("pads a two-digit jersey number and joins first/last name", () => {
    expect(reportFileName(player)).toBe("06-Jackson-Kaye.pdf");
  });

  it("omits the jersey prefix when the player has none", () => {
    expect(reportFileName(noJersey)).toBe("Eli-Carter.pdf");
  });

  it("strips characters unsafe for a filename from the name", () => {
    expect(reportFileName({ first_name: "O'Brian", last_name: "St. John", jersey_number: 3 })).toBe(
      "03-OBrian-StJohn.pdf",
    );
  });
});

describe("bulkReportFileName", () => {
  it("stays flat (no folder) for a single-group export", () => {
    expect(bulkReportFileName(player, null)).toBe("06-Jackson-Kaye.pdf");
  });

  it("nests under an age-group folder for an all-groups export", () => {
    expect(bulkReportFileName(player, "10U")).toBe("10U/06-Jackson-Kaye.pdf");
  });

  it("prevents cross-group jersey collisions via the folder prefix", () => {
    // Same jersey #6 in two different age groups -> different zip paths.
    const a = bulkReportFileName({ ...player, jersey_number: 6 }, "10U");
    const b = bulkReportFileName({ first_name: "Marcus", last_name: "Diaz", jersey_number: 6 }, "11U");
    expect(a).not.toBe(b);
  });
});
