import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PlayerGradeValue = "offer" | "bubble" | "pass";

export interface PlayerGrade {
  id: string;
  player_id: string;
  coach_id: string;
  organization_id: string;
  grade: PlayerGradeValue;
  created_at: string;
  updated_at: string;
}

export function usePlayerGrades() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["player_grades", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("player_grades")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data as PlayerGrade[];
    },
    enabled: !!organizationId,
  });
}

export function useMyPlayerGrades() {
  const { organizationId, user } = useAuth();
  return useQuery({
    queryKey: ["player_grades", "mine", organizationId, user?.id],
    queryFn: async () => {
      if (!organizationId || !user) return [];
      const { data, error } = await supabase
        .from("player_grades")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("coach_id", user.id);
      if (error) throw error;
      return data as PlayerGrade[];
    },
    enabled: !!organizationId && !!user,
  });
}

export function useSetPlayerGrade() {
  const qc = useQueryClient();
  const { organizationId, user } = useAuth();

  return useMutation({
    mutationFn: async ({ playerId, grade }: { playerId: string; grade: PlayerGradeValue | null }) => {
      if (!organizationId || !user) throw new Error("Not authenticated");

      if (grade === null) {
        const { error } = await supabase
          .from("player_grades")
          .delete()
          .eq("player_id", playerId)
          .eq("coach_id", user.id);
        if (error) throw error;
        return null;
      }

      const { data, error } = await supabase
        .from("player_grades")
        .upsert(
          {
            player_id: playerId,
            coach_id: user.id,
            organization_id: organizationId,
            grade,
          },
          { onConflict: "player_id,coach_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player_grades"] });
    },
  });
}
