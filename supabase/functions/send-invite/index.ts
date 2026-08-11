// Supabase Edge Function: send-invite
// Emails an organization invite link via Resend.
//
// Security: the caller's JWT identifies them; the function loads the invite
// with the service-role key and verifies the caller is an ADMIN of that
// invite's org before sending. The client only passes an inviteId, so it can't
// be used to spam arbitrary addresses.
//
// Required secrets (supabase secrets set ...):
//   RESEND_API_KEY     - Resend API key
//   INVITE_FROM_EMAIL  - verified sender, e.g. "DiamondAudit <invites@diamondaudit.io>"
//   SITE_URL           - e.g. "https://diamondaudit.io" (used to build the link)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the platform.
//
// Deploy: supabase functions deploy send-invite

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Escape user-controlled values before interpolating them into the email HTML.
// The org name is admin-controlled free text, so without this an admin could
// inject markup into an email sent from our verified domain.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVITE_FROM_EMAIL") ?? "DiamondAudit <onboarding@resend.dev>";
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://diamondaudit.io";

    if (!resendKey) return json({ error: "Email not configured (RESEND_API_KEY missing)" }, 500);

    const { inviteId } = await req.json().catch(() => ({}));
    if (!inviteId) return json({ error: "Missing inviteId" }, 400);

    // Identify caller from their JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Service-role client to read the invite + verify caller is an org admin.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invite } = await admin
      .from("organization_invites")
      .select("id, email, role, organization_id, status")
      .eq("id", inviteId)
      .single();
    if (!invite) return json({ error: "Invite not found" }, 404);

    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", invite.organization_id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Forbidden" }, 403);

    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id)
      .single();
    const orgName = org?.name ?? "a DiamondAudit organization";
    // orgName is admin-controlled free text; escape it (and the role) before it
    // goes into the email HTML. The subject below is plain text, so it uses the
    // raw value.
    const safeOrgName = escapeHtml(orgName);
    const safeRole = escapeHtml(String(invite.role));

    const link = `${siteUrl}/auth?invite=1&email=${encodeURIComponent(invite.email)}`;

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">You're invited to ${safeOrgName}</h2>
        <p style="color:#444; font-size:15px; line-height:1.5;">
          You've been invited to join <strong>${safeOrgName}</strong> on DiamondAudit as a ${safeRole}.
          Click below to accept and get started.
        </p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#dc2626; color:#fff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:600; display:inline-block;">
            Accept invitation
          </a>
        </p>
        <p style="color:#888; font-size:13px;">Or paste this link into your browser:<br>${link}</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: invite.email,
        subject: `You're invited to ${orgName} on DiamondAudit`,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Email send failed", detail }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
