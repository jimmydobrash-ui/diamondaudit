import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type Evaluation = Tables<"evaluations">;

export function useEvaluations() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["evaluations", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("evaluations")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data as Evaluation[];
    },
    enabled: !!organizationId,
  });
}

export function usePlayerEvaluation(playerId: string | undefined) {
  const { organizationId, user } = useAuth();
  return useQuery({
    queryKey: ["evaluation", playerId, user?.id],
    queryFn: async () => {
      if (!organizationId || !playerId || !user) return null;
      const { data, error } = await supabase
        .from("evaluations")
        .select("*")
        .eq("player_id", playerId)
        .eq("coach_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as Evaluation | null;
    },
    enabled: !!organizationId && !!playerId && !!user,
  });
}

export function useSaveEvaluation() {
  const qc = useQueryClient();
  const { organizationId, user } = useAuth();

  return useMutation({
    mutationFn: async ({ playerId, scores, notes }: { playerId: string; scores: Record<string, number>; notes: string }) => {
      if (!organizationId || !user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("evaluations")
        .upsert(
          {
            player_id: playerId,
            coach_id: user.id,
            organization_id: organizationId,
            scores: scores as any,
            notes,
          },
          { onConflict: "player_id,coach_id,event_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
      qc.invalidateQueries({ queryKey: ["evaluation", vars.playerId] });
    },
  });
}
