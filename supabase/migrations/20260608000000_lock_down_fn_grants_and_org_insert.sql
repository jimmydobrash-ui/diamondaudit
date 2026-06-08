-- ============================================================
-- Migration: lock down function EXECUTE grants + org INSERT
-- ============================================================
-- Addresses Supabase security advisors:
--  * anon/PUBLIC could call SECURITY DEFINER helpers via /rest/v1/rpc/*. These
--    helpers accept arbitrary user/org ids, so public reachability leaks org
--    membership ("is user X an admin of org Y?").
--  * organizations INSERT used WITH CHECK (true), bypassing RLS for inserts.
-- ============================================================

-- 1a. Internal-only functions (triggers / setup): not meant to be called via
--     the REST API at all. Triggers still fire regardless of EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 1b. RLS helper functions: evaluated inside RLS policies, so `authenticated`
--     must keep EXECUTE. Only remove anonymous / PUBLIC reachability.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;

-- 1c. App RPC: signed-in users only.
REVOKE EXECUTE ON FUNCTION public.upsert_evaluation(uuid, uuid, jsonb, text, uuid) FROM PUBLIC, anon;

-- 2. Tighten organizations INSERT (was WITH CHECK (true)). Allow only the
--    signup bootstrap: a user with no role yet creating their first org
--    (mirrors the user_roles bootstrap policy). Invited users join an existing
--    org via auto-accept and never create one.
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Users can create their first organization"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );
