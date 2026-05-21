import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, Check, X } from "lucide-react";

interface Invite {
  id: string;
  organization_id: string;
  role: "admin" | "coach";
  org_name?: string;
}

export default function PendingInviteBanner() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data } = await supabase
        .from("organization_invites")
        .select("id, organization_id, role")
        .eq("status", "pending")
        .ilike("email", user.email!)
        .gt("expires_at", new Date().toISOString());

      if (!data?.length) return;

      const orgIds = [...new Set(data.map(d => d.organization_id))];
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      const orgMap = Object.fromEntries((orgs ?? []).map(o => [o.id, o.name]));
      setInvites(data.map(d => ({ ...d, org_name: orgMap[d.organization_id] })));
    })();
  }, [user]);

  const acceptInvite = async (invite: Invite) => {
    if (!user) return;

    // Add user role
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: user.id,
      organization_id: invite.organization_id,
      role: invite.role,
    });

    if (roleErr && roleErr.code !== "23505") {
      toast.error("Failed to accept invite");
      return;
    }

    // Mark invite as accepted
    await supabase
      .from("organization_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    toast.success(`Joined ${invite.org_name ?? "organization"}!`);
    setInvites(prev => prev.filter(i => i.id !== invite.id));

    // Switch to the new org
    await supabase
      .from("profiles")
      .update({ current_organization_id: invite.organization_id })
      .eq("user_id", user.id);

    window.location.reload();
  };

  const dismissInvite = async (invite: Invite) => {
    await supabase
      .from("organization_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    setInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  if (!invites.length) return null;

  return (
    <div className="container py-2">
      {invites.map(invite => (
        <div key={invite.id} className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            You've been invited to join <strong>{invite.org_name}</strong> as a {invite.role}.
          </p>
          <button
            onClick={() => acceptInvite(invite)}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => dismissInvite(invite)}
            className="h-8 w-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
