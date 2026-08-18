import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * The current organization's name/slug — used for filenames and document
 * headers on export/archive screens. Members can read their own org (see the
 * "Members can view their organization" RLS policy) — the same access level
 * OrgSwitcher already relies on for its org-name display.
 */
export function useOrganization() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async (): Promise<Organization | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}
