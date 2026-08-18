import { describe, it, expect } from "vitest";
import { reportFileName, bulkReportFileName, playerNotesFromEvaluations, buildReportCardBundle, type ReportCardPlayer } from "./reportCard";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";

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

describe("playerNotesFromEvaluations", () => {
  it("collects non-empty notes for the given player, named by coach", () => {
    const notes = playerNotesFromEvaluations(
      "p1",
      [
        { player_id: "p1", coach_id: "c1", notes: "Good bat speed" },
        { player_id: "p2", coach_id: "c1", notes: "Not this player" },
      ],
      { c1: "Coach A" },
    );
    expect(notes).toEqual([{ coachName: "Coach A", text: "Good bat speed" }]);
  });

  it("falls back to 'Coach' when there's no name mapping, mirroring PlayerDetail's inline pattern", () => {
    const notes = playerNotesFromEvaluations("p1", [{ player_id: "p1", coach_id: "c1", notes: "Hi" }], {});
    expect(notes[0].coachName).toBe("Coach");
  });

  it("skips null and whitespace-only notes", () => {
    const notes = playerNotesFromEvaluations(
      "p1",
      [
        { player_id: "p1", coach_id: "c1", notes: null },
        { player_id: "p1", coach_id: "c2", notes: "   " },
      ],
      {},
    );
    expect(notes).toEqual([]);
  });
});

describe("buildReportCardBundle", () => {
  const categories: TemplateCategory[] = [
    {
      id: "hitting",
      name: "Hitting",
      skills: [
        { id: "contact", label: "Contact", type: "slider" },
        { id: "exitVelo", label: "Exit Velo", type: "number", unit: "mph" },
      ],
    },
  ];
  const p1: ReportCardPlayer = {
    id: "p1", first_name: "Jackson", last_name: "Kaye", date_of_birth: "2012-01-01",
    tags: ["10U"], positions: [], jersey_number: 6, bats: "R", throws: "R",
  };
  const p1Eval = { player_id: "p1", coach_id: "c1", scores: { contact: 8, exitVelo: 90 }, notes: "Great swing" };

  it("omits notes by default (the family-facing behavior)", () => {
    const [card] = buildReportCardBundle({
      scopedPlayers: [p1], allPlayers: [p1], evaluations: [p1Eval], categories, folderPerGroup: false,
    });
    expect(card.report.notes).toBeUndefined();
  });

  it("includes notes only when includeNotes is true", () => {
    const [card] = buildReportCardBundle({
      scopedPlayers: [p1], allPlayers: [p1], evaluations: [p1Eval], categories, folderPerGroup: false,
      includeNotes: true, memberNameById: { c1: "Coach A" },
    });
    expect(card.report.notes).toEqual([{ coachName: "Coach A", text: "Great swing" }]);
  });

  it("nests the filename under an age-group folder only when folderPerGroup is true", () => {
    const [flat] = buildReportCardBundle({ scopedPlayers: [p1], allPlayers: [p1], evaluations: [p1Eval], categories, folderPerGroup: false });
    const [nested] = buildReportCardBundle({ scopedPlayers: [p1], allPlayers: [p1], evaluations: [p1Eval], categories, folderPerGroup: true });
    expect(flat.filename).toBe("06-Jackson-Kaye.pdf");
    expect(nested.filename).toBe("10U/06-Jackson-Kaye.pdf");
  });

  it("scopes peer percentiles off allPlayers, not just scopedPlayers", () => {
    const filler = (id: string): ReportCardPlayer => ({
      id, first_name: "F", last_name: id, date_of_birth: "2012-01-01",
      tags: ["10U"], positions: [], jersey_number: null, bats: "R", throws: "R",
    });
    const fillerEval = (id: string, exitVelo: number) => ({ player_id: id, coach_id: "c1", scores: { contact: 5, exitVelo }, notes: null });
    const peers = ["p2", "p3", "p4"].map(filler);
    const peerEvals = [fillerEval("p2", 50), fillerEval("p3", 55), fillerEval("p4", 60)];

    const [card] = buildReportCardBundle({
      scopedPlayers: [p1], // only p1 is being built a card for...
      allPlayers: [p1, ...peers], // ...but all 4 are on the roster, same age group
      evaluations: [p1Eval, ...peerEvals],
      categories,
      folderPerGroup: false,
    });

    const exitVelo = card.report.categories[0]?.measurables.find(m => m.id === "exitVelo");
    // p1's 90mph beats all 3 peers -> rank 1 of 4 -> present, even though the
    // peers were never in scopedPlayers (would be null/absent if peer values
    // were wrongly scoped off scopedPlayers alone, since minPeers=4).
    expect(exitVelo?.standing).toEqual({ rank: 1, total: 4, percentile: 75 });
  });
});
