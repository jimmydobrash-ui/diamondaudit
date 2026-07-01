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
  /** Optional tags (e.g. ["14U"] to override the DOB-derived tryout age group). */
  tags: string[];
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

  // Preserve raw (lower-cased) header cells for Playbook detection — Playbook's
  // column names contain spaces (e.g. "Participant player_position") that the
  // strict normHeader would collapse and mis-match. We only aggressively
  // normalise for the native (short-headered) format.
  const rawHeaderCells = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  if (isPlaybookHeader(rawHeaderCells)) {
    return parsePlaybookCsv(lines, rawHeaderCells, existingKeys);
  }

  const headerCells = rawHeaderCells.map(normHeader);
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
      tags: [],
    });
  }

  return { players, errors };
}

/**
 * Playbook is our booking software. Its class-registration CSV is very wide
 * (~36 columns of billing/waiver metadata) but has the shape we need for the
 * tryout roster: participant_name, dob, class_session, and player_position.
 *
 * We detect it by looking for the signature columns and then translate to
 * ParsedPlayer directly (instead of trying to funnel it through the native
 * header parser). Detection is case-insensitive and tolerates missing columns.
 */
function isPlaybookHeader(headerCells: string[]): boolean {
  const set = new Set(headerCells);
  // participant_name + dob is the tightest tell; class_session confirms it.
  return set.has("participant_name") && set.has("dob") && set.has("class_session");
}

/** Normalise Playbook's position names (RHP/LHP → P; strip suffixes). */
function normalisePosition(raw: string): string {
  const p = raw.trim().toUpperCase();
  if (p === "RHP" || p === "LHP") return "P";
  return p;
}

/** Extract the tryout age group tag (e.g. "14U") from a Playbook class_session. */
function extractAgeGroupTag(classSession: string): string | null {
  // Matches patterns like "14u", "14U", "11U 2027 Youth Team Tryouts"
  const m = classSession.match(/\b(\d{1,2})[uU]\b/);
  return m ? `${m[1]}U` : null;
}

/**
 * Split "Firstname Middle Lastname" into first + last. Uses the first space so
 * compound last names ("Gomez Rios") stay together; coaches can fix the
 * ~occasional mis-split (e.g. "Jean Paul Smith") via the player edit form.
 */
function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  const i = trimmed.indexOf(" ");
  return i < 0
    ? { first: trimmed, last: "" }
    : { first: trimmed.slice(0, i), last: trimmed.slice(i + 1) };
}

function parsePlaybookCsv(
  lines: string[],
  headerCells: string[],
  existingKeys: Set<string>,
): ParseResult {
  const idx = (name: string) => headerCells.indexOf(name);
  const cName = idx("participant_name");
  const cDob = idx("dob");
  const cSession = idx("class_session");
  const cPos = idx("participant player_position"); // Playbook prefixes some fields "Participant "
  const cTeam = idx("participant former_team");
  const cGender = idx("gender");

  const players: ParsedPlayer[] = [];
  const errors: string[] = [];
  const seen = new Set<string>(existingKeys);

  for (let i = 1; i < lines.length; i++) {
    const fileRow = i + 1;
    const vals = splitCsvLine(lines[i]);
    const cell = (c: number) => (c < 0 ? "" : (vals[c] ?? "").trim());

    const fullName = cell(cName);
    if (!fullName) { errors.push(`Row ${fileRow}: Missing participant_name`); continue; }
    const { first: firstName, last: lastName } = splitFullName(fullName);
    if (!lastName) {
      errors.push(`Row ${fileRow}: ${fullName} has no last name — set it manually after import`);
    }

    const dobRaw = cell(cDob);
    if (!dobRaw) { errors.push(`Row ${fileRow}: Missing dob for ${fullName}`); continue; }
    const parsedDate = new Date(dobRaw);
    if (isNaN(parsedDate.getTime())) {
      errors.push(`Row ${fileRow}: Invalid dob "${dobRaw}" for ${fullName}`);
      continue;
    }
    const isoDob = parsedDate.toISOString().split("T")[0];

    const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${isoDob}`;
    if (seen.has(key)) {
      errors.push(
        existingKeys.has(key)
          ? `Row ${fileRow}: ${fullName} (${isoDob}) is already on the roster — skipped`
          : `Row ${fileRow}: ${fullName} (${isoDob}) appears twice in the file — skipped`,
      );
      continue;
    }
    seen.add(key);

    const positions = cell(cPos)
      .split(",")
      .map(normalisePosition)
      .filter(Boolean);

    const ageTag = extractAgeGroupTag(cell(cSession));
    const tags = ageTag ? [ageTag] : [];

    const gender = cell(cGender).toUpperCase();
    // Playbook uses ML/FM for gender; the app expects L/R/S for bats and L/R for
    // throws, which don't come from Playbook — leave both at default R.
    const bats = "R";
    const throws_ = "R";

    const team = cell(cTeam);
    const notes = team ? `Former team: ${team}` : "";

    players.push({
      first_name: firstName,
      last_name: lastName || fullName, // fall back so DB NOT NULL constraint is satisfied
      date_of_birth: isoDob,
      positions,
      bats,
      throws: throws_,
      height: null,
      weight: null,
      jersey_number: null,
      notes,
      tags,
    });
    // Suppress unused-var lint: gender is documented above.
    void gender;
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
