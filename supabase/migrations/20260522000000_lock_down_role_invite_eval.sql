-- ============================================================
-- Migration: lock down role insertion, invite mutation, eval RPC ownership
-- ============================================================
-- Addresses three findings from a security audit:
--
-- 1. user_roles INSERT was open to any authenticated user for themselves —
--    a coach who knew any org's UUID could grant themselves admin in that
--    org. Restrict to (a) bootstrap (no existing roles for this user) OR
--    (b) a matching pending invite for this email + org + role.
--
-- 2. organization_invites UPDATE policy let recipients change any column
--    (including role and expires_at). Add a BEFORE UPDATE trigger that
--    enforces immutability of the protected columns. Status / updated_at
--    may still change.
--
-- 3. upsert_evaluation only verified the caller's org membership, not
--    that p_player_id (or p_event_id) actually belonged to that org.
--    Add ownership guards so cross-org IDs are rejected.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Restrict user_roles INSERT
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE POLICY "Users can bootstrap or accept invite role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      -- bootstrap path: user currently has no roles in any org
      NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
      )
      OR
      -- invite path: a matching pending invite exists for this email + org + role
      EXISTS (
        SELECT 1 FROM public.organization_invites oi
        WHERE oi.organization_id = user_roles.organization_id
          AND oi.role = user_roles.role
          AND oi.status = 'pending'
          AND oi.expires_at > now()
          AND lower(oi.email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

-- ------------------------------------------------------------
-- 2. Lock immutable columns on organization_invites updates
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_invite_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'organization_invites: only status may be changed after creation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invite_update_trigger ON public.organization_invites;

CREATE TRIGGER guard_invite_update_trigger
  BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION public.guard_invite_update();

-- ------------------------------------------------------------
-- 3. Verify player/event ownership in upsert_evaluation
-- ------------------------------------------------------------
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

  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = p_player_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Player not found in this organization';
  END IF;

  IF p_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tryout_events
    WHERE id = p_event_id AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Event not found in this organization';
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
