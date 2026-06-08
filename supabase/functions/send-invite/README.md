# send-invite

Emails an organization invite link via [Resend](https://resend.com). Called by
`InviteCoachDialog` after it creates the `organization_invites` row. Until this
is deployed and configured, the dialog gracefully falls back to the copy-link
flow, so invites keep working either way.

## One-time setup

1. **Resend account + API key**
   - Create an account at resend.com and add an API key.
   - Verify a sending domain (e.g. `diamondaudit.io`) so mail isn't spam-foldered.
     For a quick test you can use Resend's `onboarding@resend.dev` sender.

2. **Set the function secrets** (Supabase CLI, from the repo root):
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set INVITE_FROM_EMAIL="DiamondAudit <invites@diamondaudit.io>"
   supabase secrets set SITE_URL="https://diamondaudit.io"
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
   injected by the platform — don't set them manually.

3. **Deploy**:
   ```bash
   supabase functions deploy send-invite
   ```
   (Or via the Supabase MCP `deploy_edge_function`.)

## Security

The client only sends an `inviteId`. The function identifies the caller from
their JWT, loads the invite with the service-role key, and verifies the caller
is an **admin** of that invite's organization before sending — so it can't be
used to email arbitrary addresses.
