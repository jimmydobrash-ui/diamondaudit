import { playerAgeGroup } from "./mock-data";

/** Minimal shape needed to order a player in the tryout running order. */
export interface OrderablePlayer {
  date_of_birth: string;
  tags: string[] | null;
  jersey_number: number | null;
  last_name: string;
}

/** The player's age group as a number (e.g. "12U" -> 12); groups with no
 *  parseable number sort last. */
export function numericAgeGroup(p: OrderablePlayer): number {
  const n = parseInt(playerAgeGroup(p), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

/**
 * Order players the way a tryout actually runs: youngest age group first, then
 * by jersey number ascending (players without a number sort last), then by last
 * name. Used for the evaluate list and for next/prev navigation on the eval
 * screen so "next" matches who's physically up next, not alphabetical order.
 */
export function compareForTryout(a: OrderablePlayer, b: OrderablePlayer): number {
  const ag = numericAgeGroup(a);
  const bg = numericAgeGroup(b);
  if (ag !== bg) return ag - bg;

  const ja = a.jersey_number;
  const jb = b.jersey_number;
  if (ja != null && jb != null && ja !== jb) return ja - jb;
  if (ja != null && jb == null) return -1; // numbered players before un-numbered
  if (ja == null && jb != null) return 1;

  return a.last_name.localeCompare(b.last_name);
}
