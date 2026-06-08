import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { toast } from "sonner";

interface OrgOption {
  id: string;
  name: string;
}

export default function OrgSwitcher() {
  const { user, organizationId } = useAuth();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [open, setOpen] = useState(false);
  const [currentOrgName, setCurrentOrgName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("organization_id")
        .eq("user_id", user.id);

      if (!roles?.length) return;

      const orgIds = [...new Set(roles.map(r => r.organization_id))];
      const { data: orgRows } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);

      if (orgRows) {
        setOrgs(orgRows);
        const current = orgRows.find(o => o.id === organizationId);
        if (current) setCurrentOrgName(current.name);
      }
    })();
  }, [user, organizationId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (orgs.length <= 1) return null;

  const switchOrg = async (orgId: string) => {
    if (orgId === organizationId || !user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ current_organization_id: orgId })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to switch organization");
      return;
    }
    toast.success("Switching organization…");
    window.location.reload();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch organization"
        className="h-8 px-3 rounded-full bg-secondary flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors max-w-[160px]"
      >
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{currentOrgName}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-56 bg-card rounded-xl border shadow-lg py-1">
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => { switchOrg(org.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                {org.id === organizationId ? (
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="truncate">{org.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
