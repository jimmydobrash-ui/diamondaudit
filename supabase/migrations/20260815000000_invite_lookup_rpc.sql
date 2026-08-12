-- ============================================================
-- Migration: invite lookup RPC (stop putting invitee emails in URLs)
-- ============================================================
-- Invite links used to carry the invitee's raw email address in the query
-- string: /auth?invite=1&email=someone@example.com. That leaks the email
-- into browser history, the Referer header on any outbound navigation from
-- that page, server access logs, and (now that analytics is being added)
-- pageview events. This is a youth-sports product, so that's real PII
-- hygiene exposure, not a theoretical one.
--
-- The link now carries only the invite row's own primary key, which is
-- already an unguessable UUID and already the value send-invite worked
-- with internally: /auth?invite=<uuid>. Auth.tsx resolves that id to the
-- email client-side, right before it's needed to prefill the signup form,
-- and never puts it back in the URL.
--
-- WHY SECURITY DEFINER: the existing organization_invites SELECT policy
-- only lets a caller read a row that matches their OWN signed-in email
-- (`lower(email) = lower(auth.jwt()->>'email')`). A brand-new invitee
-- landing on /auth to sign up is anonymous — there is no signed-in email
-- yet — so a plain `.select()` by id returns nothing under RLS. This
-- function runs as its owner to bridge that one gap, but stays narrow on
-- every axis that matters:
--   * input is the invite's unguessable UUID, not a searchable field —
--     there's no way to enumerate or look up invites by email/org here;
--   * output is exactly the two fields the signup form needs (email to
--     prefill, org name for a "you've been invited to X" greeting) — never
--     the full row, role, inviter, or expiry;
--   * the WHERE clause only matches invites that are still `pending` and
--     unexpired, so a stale, already-accepted, or revoked link discloses
--     nothing.
--
-- Net trade-off: this still hands an email address to an anonymous caller,
-- but only to whoever already holds the unguessable invite link — the same
-- party who could already see that email by definition (it's addressed to
-- them). What it removes is the email sitting in plaintext in the URL,
-- which persisted in browser history, Referer headers, and server/analytics
-- logs well beyond the single moment the link is used. That's strictly
-- worse than this function's exposure, which is why this trade is worth
-- making.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_invite_email(p_invite_id uuid)
RETURNS TABLE(email text, organization_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.email, o.name AS organization_name
  FROM public.organization_invites oi
  JOIN public.organizations o ON o.id = oi.organization_id
  WHERE oi.id = p_invite_id
    AND oi.status = 'pending'
    AND oi.expires_at > now()
$$;

-- Revoke the default PUBLIC grant first so access is explicit and
-- deliberate, then grant to exactly the two roles that need it: anon (an
-- invitee is signed out when they first land on /auth) and authenticated
-- (an already-registered user can hit the same link too).
REVOKE EXECUTE ON FUNCTION public.get_invite_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_email(uuid) TO anon, authenticated;
