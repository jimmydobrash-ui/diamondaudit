import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

export interface TemplateSkill {
  id: string;
  label: string;
  type: "slider" | "number";
  unit?: string; // e.g. "mph", "sec"
}

export interface TemplateCategory {
  id: string;
  name: string;
  skills: TemplateSkill[];
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  sport: string;
  is_default: boolean;
  categories: TemplateCategory[];
  organization_id: string;
}

export function useEvaluationTemplate() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["evaluation-template", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("evaluation_templates")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        categories: data.categories as unknown as TemplateCategory[],
      } as EvaluationTemplate;
    },
    enabled: !!organizationId,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async ({ id, name, categories }: { id?: string; name: string; categories: TemplateCategory[] }) => {
      if (!organizationId) throw new Error("No organization");
      const payload = {
        name,
        organization_id: organizationId,
        is_default: true,
        categories: categories as unknown as Json,
      };

      if (id) {
        const { data, error } = await supabase
          .from("evaluation_templates")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("evaluation_templates")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluation-template"] });
    },
  });
}
