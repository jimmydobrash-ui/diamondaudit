-- ============================================================
-- Migration: tighten profile RLS, fix evaluation uniqueness
-- ============================================================
-- 1. (S-1) Profiles SELECT was globally readable to all authenticated users.
--    Restrict to: yourself, OR users that share an org with you.
-- 2. (P-1) UNIQUE (player_id, coach_id, event_id) doesn't actually enforce
--    one-per-coach when event_id IS NULL (Postgres treats NULLs as distinct).
--    Replace with two partial unique indexes that cover both cases, and
--    expose a SECURITY DEFINER RPC that does a race-safe upsert.
-- ============================================================

-- (S-1) profile read policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view org member profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id
        AND public.is_org_member(auth.uid(), ur.organization_id)
    )
  );

-- (P-1) drop the broken UNIQUE constraint
ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_player_id_coach_id_event_id_key;

-- Defensive: dedupe any (player_id, coach_id) duplicates that the broken
-- UNIQUE constraint allowed in. Keep the most recently updated row.
DELETE FROM public.evaluations a
USING public.evaluations b
WHERE a.player_id = b.player_id
  AND a.coach_id = b.coach_id
  AND a.event_id IS NULL
  AND b.event_id IS NULL
  AND a.id <> b.id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

-- Partial unique index: one evaluation per coach per player when no event
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_player_coach_no_event_unique
  ON public.evaluations (player_id, coach_id)
  WHERE event_id IS NULL;

-- Partial unique index: one evaluation per coach per player per event
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_player_coach_event_unique
  ON public.evaluations (player_id, coach_id, event_id)
  WHERE event_id IS NOT NULL;

-- Race-safe upsert RPC. The Supabase JS upsert helper can't target a partial
-- unique index from the client, so we wrap it in a server-side function.
CREATE OR REPLACE FUNCTION public.upsert_evaluation(
  p_player_id UUID,
  p_organization_id UUID,
  p_scores JSONB,
  p_notes TEXT,
  p_event_id UUID DEFAULT NULL
) RETURNS public.evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation public.evaluations;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_organization_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF p_event_id IS NULL THEN
    INSERT INTO public.evaluations (player_id, coach_id, organization_id, scores, notes, event_id)
    VALUES (p_player_id, auth.uid(), p_organization_id, p_scores, p_notes, NULL)
    ON CONFLICT (player_id, coach_id) WHERE event_id IS NULL
    DO UPDATE SET
      scores = EXCLUDED.scores,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING * INTO v_evaluation;
  ELSE
    INSERT INTO public.evaluations (player_id, coach_id, organization_id, scores, notes, event_id)
    VALUES (p_player_id, auth.uid(), p_organization_id, p_scores, p_notes, p_event_id)
    ON CONFLICT (player_id, coach_id, event_id) WHERE event_id IS NOT NULL
    DO UPDATE SET
      scores = EXCLUDED.scores,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING * INTO v_evaluation;
  END IF;

  RETURN v_evaluation;
END;
$$;
