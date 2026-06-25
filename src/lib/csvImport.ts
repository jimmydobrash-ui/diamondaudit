/**
 * Roster CSV parsing for the Import Players flow.
 *
 * Lives in lib (not the page) so we can unit-test the parser without React.
 * The shipping tryout roster will run through this once on July 3 — losing or
 * silently corrupting a row is the failure mode we care most about, so the
 * parser is deliberately strict and explicit about issues.
 */

export interface ParsedPlayer {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  positions: string[];
  bats: string;
  throws: string;
  height: string | null;
  weight: number | null;
  jersey_number: number | null;
  notes: string;
}

export interface ParseResult {
  players: ParsedPlayer[];
  errors: string[];
}

/** RFC-4180 row splitter: handles quoted fields, embedded commas, and "" -> ". */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        // "" inside a quoted field => literal quote
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map(f => f.trim());
}

const HEADER_ALIASES: Record<string, readonly string[]> = {
  first_name: ["firstname", "first_name", "first"],
  last_name: ["lastname", "last_name", "last"],
  date_of_birth: ["dob", "dateofbirth", "date_of_birth", "birthdate", "birthday"],
  positions: ["position", "positions", "pos"],
  bats: ["bats", "bat"],
  throws: ["throws", "throw"],
  height: ["height", "ht"],
  weight: ["weight", "wt"],
  jersey_number: ["jersey", "jerseynumber", "jersey_number", "number", "num", "no"],
  notes: ["notes", "note", "comments"],
};

/** Normalise a header cell to a comparable token (lowercase, letters+underscores). */
const normHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z_]/g, "");

const dedupeKey = (firstName: string, lastName: string, dob: string) =>
  `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${dob}`;

/**
 * Parse the contents of a roster CSV into ready-to-insert player rows + a list
 * of human-readable problems. Row indices in errors are 1-based file rows.
 *
 * `existingKeys`: dedupe keys of players already in the org (from the roster
 *   query). Imports that match are skipped with a clear error pointing at the
 *   row, so re-running the CSV after a partial import doesn't double-create.
 */
export function parseRosterCsv(text: string, existingKeys: Set<string> = new Set()): ParseResult {
  // Strip a UTF-8 BOM (Excel exports often add one) before parsing.
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return { players: [], errors: ["CSV must have a header row and at least one data row"] };

  const headerCells = splitCsvLine(lines[0]).map(normHeader);
  const colIdx: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  headerCells.forEach((cell, i) => {
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if ((aliases as readonly string[]).includes(cell)) {
        colIdx[field as keyof typeof HEADER_ALIASES] ??= i;
      }
    }
  });

  if (colIdx.first_name === undefined || colIdx.last_name === undefined) {
    return { players: [], errors: ["CSV must have 'first_name' and 'last_name' columns"] };
  }

  const players: ParsedPlayer[] = [];
  const errors: string[] = [];
  const seen = new Set<string>(existingKeys); // includes existing roster + earlier rows in this file
  const get = (vals: string[], key: keyof typeof HEADER_ALIASES) => {
    const idx = colIdx[key];
    return idx === undefined ? "" : (vals[idx] ?? "").trim();
  };

  for (let i = 1; i < lines.length; i++) {
    const fileRow = i + 1;
    const vals = splitCsvLine(lines[i]);

    const firstName = get(vals, "first_name");
    const lastName = get(vals, "last_name");
    if (!firstName || !lastName) { errors.push(`Row ${fileRow}: Missing name`); continue; }

    const dob = get(vals, "date_of_birth");
    if (!dob) { errors.push(`Row ${fileRow}: Missing date of birth for ${firstName} ${lastName}`); continue; }

    const parsedDate = new Date(dob);
    if (isNaN(parsedDate.getTime())) {
      errors.push(`Row ${fileRow}: Invalid date "${dob}" for ${firstName} ${lastName}`);
      continue;
    }
    const isoDob = parsedDate.toISOString().split("T")[0];

    const key = dedupeKey(firstName, lastName, isoDob);
    if (seen.has(key)) {
      errors.push(
        existingKeys.has(key)
          ? `Row ${fileRow}: ${firstName} ${lastName} (${isoDob}) is already on the roster — skipped`
          : `Row ${fileRow}: ${firstName} ${lastName} (${isoDob}) appears twice in the file — skipped`,
      );
      continue;
    }
    seen.add(key);

    const bats = get(vals, "bats").toUpperCase();
    const throws_ = get(vals, "throws").toUpperCase();
    const positions = get(vals, "positions")
      .split(/[/;|]/)
      .map(p => p.trim().toUpperCase())
      .filter(Boolean);
    const rawWeight = get(vals, "weight");
    const rawJersey = get(vals, "jersey_number");
    const weight = rawWeight ? Number(rawWeight) : null;
    const jersey = rawJersey ? Number(rawJersey) : null;

    players.push({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: isoDob,
      positions,
      bats: ["L", "R", "S"].includes(bats) ? bats : "R",
      throws: ["L", "R"].includes(throws_) ? throws_ : "R",
      height: get(vals, "height") || null,
      weight: weight !== null && !isNaN(weight) ? weight : null,
      jersey_number: jersey !== null && !isNaN(jersey) ? jersey : null,
      notes: get(vals, "notes"),
    });
  }

  return { players, errors };
}

/** Build the dedupe-key set from the org's current roster query result. */
export function rosterDedupeKeys(
  existing: { first_name: string; last_name: string; date_of_birth: string | null }[],
): Set<string> {
  return new Set(
    existing
      .filter(p => p.date_of_birth)
      .map(p => dedupeKey(p.first_name, p.last_name, p.date_of_birth as string)),
  );
}
