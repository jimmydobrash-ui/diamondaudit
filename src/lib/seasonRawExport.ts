import JSZip from "jszip";
import type { TemplateCategory } from "@/hooks/useEvaluationTemplate";
import type { Player } from "@/hooks/usePlayers";
import type { Evaluation } from "@/hooks/useEvaluations";
import type { PlayerGrade } from "@/hooks/usePlayerGrades";
import { playerAgeGroup } from "./mock-data";
import { toCsv } from "./csv";

// A player shape narrow enough for name/age-group lookups, satisfied by the
// real Player type — kept separate so these CSV builders don't need the full
// row shape wherever they're called from.
type PlayerLookup = { id: string; first_name: string; last_name: string; date_of_birth: string; tags: string[] | null };

const BOM = "﻿";

export function playersToCsv(players: Player[]): string {
  const headers = [
    "Player ID", "First Name", "Last Name", "Date of Birth", "Age Group",
    "Positions", "Bats", "Throws", "Height", "Weight", "Jersey Number",
    "Roster Notes", "Tags", "Created At", "Updated At",
  ];
  const rows = players.map(p => [
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    playerAgeGroup(p),
    (p.positions ?? []).join(" / "),
    p.bats,
    p.throws,
    p.height ?? "",
    p.weight ?? "",
    p.jersey_number ?? "",
    p.notes ?? "",
    (p.tags ?? []).join(" / "),
    p.created_at,
    p.updated_at,
  ]);
  return toCsv(headers, rows);
}

/**
 * Raw, per-coach, unaggregated evaluations — a player scored by 3 coaches
 * produces 3 rows here (this is the "audit trail" export; aggregated/rolled-up
 * views live everywhere else in the app already). One column per skill in the
 * current template's order; any skill id found in the data but no longer in
 * the template (removed/renamed since it was scored) gets its own trailing
 * column labeled by its raw id, so historical data is never silently dropped.
 */
export function evaluationsToCsv(
  evaluations: Evaluation[],
  categories: TemplateCategory[],
  players: PlayerLookup[],
  coachNameById: Record<string, string>,
): string {
  const playerById = new Map(players.map(p => [p.id, p]));
  const knownSkills = categories.flatMap(c =>
    c.skills.map(s => ({ id: s.id, label: `${c.name}: ${s.label}${s.unit ? ` (${s.unit})` : ""}` })),
  );
  const knownIds = new Set(knownSkills.map(s => s.id));

  const orphanIds = new Set<string>();
  for (const ev of evaluations) {
    for (const id of Object.keys((ev.scores as Record<string, number>) ?? {})) {
      if (!knownIds.has(id)) orphanIds.add(id);
    }
  }
  const orphanList = [...orphanIds].sort();

  const headers = [
    "Evaluation ID", "Player ID", "Player Name", "Age Group", "Coach ID", "Coach Name",
    ...knownSkills.map(s => s.label),
    ...orphanList.map(id => `(removed skill) ${id}`),
    "Notes", "Created At", "Updated At",
  ];

  const rows = evaluations.map(ev => {
    const p = playerById.get(ev.player_id);
    const scores = (ev.scores as Record<string, number>) ?? {};
    return [
      ev.id,
      ev.player_id,
      p ? `${p.first_name} ${p.last_name}` : "",
      p ? playerAgeGroup(p) : "",
      ev.coach_id,
      coachNameById[ev.coach_id] ?? "Coach",
      ...knownSkills.map(s => scores[s.id] ?? ""),
      ...orphanList.map(id => scores[id] ?? ""),
      ev.notes ?? "",
      ev.created_at,
      ev.updated_at,
    ];
  });

  return toCsv(headers, rows);
}

/** Every coach's individual grade for every player they graded — not just
 *  Offers (unlike Team Builder's own export, which is scoped to the signed-in
 *  coach's Offers only). One row per (player, coach) grade, matching the
 *  underlying unique constraint. */
export function gradesToCsv(
  grades: PlayerGrade[],
  players: PlayerLookup[],
  coachNameById: Record<string, string>,
): string {
  const playerById = new Map(players.map(p => [p.id, p]));
  const headers = ["Grade ID", "Player ID", "Player Name", "Age Group", "Coach ID", "Coach Name", "Grade", "Created At", "Updated At"];
  const rows = grades.map(g => {
    const p = playerById.get(g.player_id);
    return [
      g.id,
      g.player_id,
      p ? `${p.first_name} ${p.last_name}` : "",
      p ? playerAgeGroup(p) : "",
      g.coach_id,
      coachNameById[g.coach_id] ?? "Coach",
      g.grade,
      g.created_at,
      g.updated_at,
    ];
  });
  return toCsv(headers, rows);
}

function buildReadme(orgName: string, playerCount: number, evalCount: number, gradeCount: number): string {
  return [
    `${orgName} — Season Raw Export`,
    `Generated ${new Date().toISOString()}`,
    "",
    `players.csv — ${playerCount} rows, every roster field.`,
    `evaluations.csv — ${evalCount} rows, one per coach's evaluation of a player (raw, unaggregated per-skill scores + notes — a player scored by 3 coaches has 3 rows here).`,
    `player_grades.csv — ${gradeCount} rows, every coach's individual grade (offer/bubble/pass) for every player they graded.`,
    "",
    "This is a reference/audit archive, not a one-click restore — no importer for evaluations or grades exists in the app today (the Import Players flow only covers a subset of players.csv's columns).",
  ].join("\n");
}

/** Bundles players.csv + evaluations.csv + player_grades.csv + a README into one zip. */
export async function buildSeasonRawExportZip(input: {
  orgName: string;
  players: Player[];
  evaluations: Evaluation[];
  grades: PlayerGrade[];
  categories: TemplateCategory[];
  coachNameById: Record<string, string>;
}): Promise<Blob> {
  const zip = new JSZip();
  zip.file("players.csv", BOM + playersToCsv(input.players));
  zip.file(
    "evaluations.csv",
    BOM + evaluationsToCsv(input.evaluations, input.categories, input.players, input.coachNameById),
  );
  zip.file("player_grades.csv", BOM + gradesToCsv(input.grades, input.players, input.coachNameById));
  zip.file("README.txt", buildReadme(input.orgName, input.players.length, input.evaluations.length, input.grades.length));
  return zip.generateAsync({ type: "blob" });
}
