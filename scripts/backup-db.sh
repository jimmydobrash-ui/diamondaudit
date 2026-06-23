#!/usr/bin/env bash
#
# Full backup (schema + data) of the DiamondAudit Supabase database.
#
# 1. Get your connection string from the Supabase dashboard:
#      Project → Connect → "Session pooler" → URI
#    Use the *Session pooler* string (works over IPv4 and supports pg_dump),
#    not the direct connection. It looks like:
#      postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
#
# 2. Run:
#      SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" ./scripts/backup-db.sh
#
# Output: backups/diamondaudit-<timestamp>.dump  (compressed custom format)
# Restore: pg_restore --clean --no-owner -d "$SUPABASE_DB_URL" <file>
#
# Uses local pg_dump if present (must be v17 to match the server); otherwise
# falls back to the postgres:17 Docker image so the version always matches.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to your Supabase Session-pooler connection string}"

cd "$(dirname "$0")/.."
mkdir -p backups
ts=$(date +%Y%m%d-%H%M%S)
out="backups/diamondaudit-${ts}.dump"

echo "Backing up DiamondAudit database → $out"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --file "$out"
else
  echo "pg_dump not found locally — using Docker (postgres:17)…"
  docker run --rm -i postgres:17 pg_dump "$SUPABASE_DB_URL" \
    --format=custom --no-owner --no-privileges > "$out"
fi

echo "✓ Backup complete: $out ($(du -h "$out" | cut -f1))"
echo "  Restore with: pg_restore --clean --no-owner -d \"\$SUPABASE_DB_URL\" \"$out\""
