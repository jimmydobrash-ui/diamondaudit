-- ============================================================
-- Migration: add WITH CHECK to the evaluations / player_grades UPDATE policies
-- ============================================================
-- The "Coaches can update own ..." UPDATE policies were created with only a
-- USING clause (auth.uid() = coach_id). Postgres then reuses USING as the
-- implicit WITH CHECK, which validates coach_id on the NEW row but NOT
-- organization_id. A coach could therefore PATCH their own row directly
-- (bypassing the upsert_evaluation RPC, which already verifies org + player
-- ownership) and set organization_id to a different org — injecting a row
-- visible to that org's members.
--
-- Exploitability is limited (needs the target org's unguessable UUID, and it's
-- write-only — no read access is gained), so this is defense-in-depth: it
-- brings the direct-table UPDATE path up to the same guarantee the RPC already
-- enforces. Legitimate app writes always set organization_id to the coach's
-- own org, so is_org_member() holds and nothing breaks.
--
-- ALTER POLICY leaves the existing USING clause untouched and only adds the
-- WITH CHECK.
-- ============================================================

ALTER POLICY "Coaches can update own evaluations" ON public.evaluations
  WITH CHECK (
    auth.uid() = coach_id
    AND public.is_org_member(auth.uid(), organization_id)
  );

ALTER POLICY "Coaches can update own grades" ON public.player_grades
  WITH CHECK (
    auth.uid() = coach_id
    AND public.is_org_member(auth.uid(), organization_id)
  );
