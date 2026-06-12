import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface OrgMember {
  userId: string;
  name: string;
  role: "admin" | "coach";
}

/**
 * Map of user_id -> { name, role } for everyone in the current org. Used to put
 * coach names on per-coach evaluation breakdowns. Profiles are readable for
 * org members (see the "Users can view org member profiles" RLS policy); falls
 * back to "Coach" if a display name isn't set.
 */
export function useOrgMembers() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["org_members", organizationId],
    queryFn: async (): Promise<Record<string, OrgMember>> => {
      if (!organizationId) return {};
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", organizationId);
      if (error) throw error;

      const ids = [...new Set((roles ?? []).map(r => r.user_id))];
      if (!ids.length) return {};

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const nameById = Object.fromEntries(
        (profiles ?? []).map(p => [p.user_id, p.display_name]),
      );

      const map: Record<string, OrgMember> = {};
      for (const r of roles ?? []) {
        map[r.user_id] = {
          userId: r.user_id,
          name: nameById[r.user_id] || "Coach",
          role: r.role,
        };
      }
      return map;
    },
    enabled: !!organizationId,
  });
}
