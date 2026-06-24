-- ============================================================
-- Migration: bump organization_invites default expiry 7d -> 14d
-- ============================================================
-- Coaches were sometimes slow to accept and signed up after the 7-day
-- window, landing in their own auto-bootstrapped org instead of the
-- inviting org. Give a wider window. Only changes the column default for
-- new invites; existing rows are untouched (the guard_invite_update
-- trigger forbids mutating expires_at anyway).
-- ============================================================

ALTER TABLE public.organization_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');
