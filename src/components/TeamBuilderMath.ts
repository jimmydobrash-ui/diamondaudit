import { playerAgeGroup } from "@/lib/mock-data";
import { numericAgeGroup } from "@/lib/rosterOrder";
import { toCsv } from "@/lib/csv";

/** Minimal player shape the Team Builder workspace needs. The real `players`
 *  row (Tables<"players">) is structurally assignable to this. */
export interface RosterPlayer {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  positions: string[];
  date_of_birth: string;
  tags: string[] | null;
}

/** Reads a player's overall (0–10), or undefined when they haven't been
 *  evaluated. Mirrors the `playerScores` map every screen builds via
 *  aggregateScoresByPlayer → calcSliderOverall. */
export type ScoreOf = (playerId: string) => number | undefined;

type NamedPlayer = Pick<RosterPlayer, "id" | "first_name" | "last_name">;

function nameKey(p: NamedPlayer): string {
  return `${p.last_name} ${p.first_name}`.toLowerCase();
}

/**
 * Order a grade column as a ranked decision queue: evaluated players first,
 * highest overall to lowest; unevaluated players last, alphabetical by name.
 * Ties among evaluated players also break alphabetically so the order is stable.
 */
export function compareByScoreThenName(a: NamedPlayer, b: NamedPlayer, scoreOf: ScoreOf): number {
  const sa = scoreOf(a.id);
  const sb = scoreOf(b.id);
  const aHas = sa !== undefined && sa > 0;
  const bHas = sb !== undefined && sb > 0;
  if (aHas && bHas) {
    if (sb !== sa) return (sb as number) - (sa as number); // higher overall first
    return nameKey(a).localeCompare(nameKey(b));
  }
  if (aHas) return -1; // evaluated before unevaluated
  if (bHas) return 1;
  return nameKey(a).localeCompare(nameKey(b)); // both unevaluated → alphabetical
}

/** Sort a copy of `players` with {@link compareByScoreThenName}. */
export function sortByScoreThenName<T extends NamedPlayer>(players: T[], scoreOf: ScoreOf): T[] {
  return [...players].sort((a, b) => compareByScoreThenName(a, b, scoreOf));
}

export interface RosterMath {
  /** Offers made in the current scope. */
  offered: number;
  /** The coach's roster-size target for this age group. */
  target: number;
  /** Spots still open (target − offered, never negative). */
  open: number;
  /** Offers beyond the target (offered − target, never negative). */
  over: number;
  /** Players still on the bubble. */
  bubble: number;
}

/** Roster-construction arithmetic for the summary band. */
export function computeRosterMath(offered: number, bubble: number, target: number): RosterMath {
  return {
    offered,
    target,
    bubble,
    open: Math.max(target - offered, 0),
    over: Math.max(offered - target, 0),
  };
}

export interface PositionCount {
  position: string;
  count: number;
}

// Defensive-spectrum order so the coverage strip reads P · C · infield · outfield.
const POSITION_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "MIF", "DH", "UTIL"];

function positionRank(pos: string): number {
  const i = POSITION_ORDER.indexOf(pos.toUpperCase());
  return i === -1 ? POSITION_ORDER.length : i;
}

/**
 * Count each position across a set of players. Players list multiple positions,
 * so every entry in `positions[]` is counted — a P/SS adds to both P and SS.
 * Ordered by the defensive spectrum, unknown labels last (alphabetical).
 */
export function positionCounts(players: Pick<RosterPlayer, "positions">[]): PositionCount[] {
  const counts: Record<string, number> = {};
  for (const p of players) {
    for (const raw of p.positions ?? []) {
      const pos = raw.trim();
      if (!pos) continue;
      counts[pos] = (counts[pos] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.position.localeCompare(b.position));
}

/**
 * Build the CSV for an Offer-graded export: jersey, name, age group, positions,
 * overall. Players are ordered youngest age group first, then highest overall,
 * so an all-groups export reads as one ranked list per team. Serialisation runs
 * through {@link toCsv}, which quotes and defuses spreadsheet formula-injection.
 */
export function offerListCsv(players: RosterPlayer[], scoreOf: ScoreOf): string {
  const ordered = [...players].sort((a, b) => {
    const byAge = numericAgeGroup(a) - numericAgeGroup(b);
    if (byAge !== 0) return byAge;
    const sb = (scoreOf(b.id) ?? 0) - (scoreOf(a.id) ?? 0);
    if (sb !== 0) return sb;
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  });
  const headers = ["Jersey", "First Name", "Last Name", "Age Group", "Positions", "Overall"];
  const rows = ordered.map(p => [
    p.jersey_number ?? "",
    p.first_name,
    p.last_name,
    playerAgeGroup(p),
    p.positions.join(" / "),
    scoreOf(p.id) ?? "",
  ]);
  return toCsv(headers, rows);
}
