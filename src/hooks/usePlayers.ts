import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Player = Tables<"players">;
export type PlayerInsert = TablesInsert<"players">;
export type PlayerUpdate = TablesUpdate<"players">;

export function usePlayers() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["players", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("organization_id", organizationId)
        .order("last_name");
      if (error) throw error;
      return data as Player[];
    },
    enabled: !!organizationId,
  });
}

export function useAddPlayer() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async (player: Omit<PlayerInsert, "organization_id">) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("players")
        .insert({ ...player, organization_id: organizationId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useAddPlayersBatch() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async (players: Omit<PlayerInsert, "organization_id">[]) => {
      if (!organizationId) throw new Error("No organization");
      const rows = players.map(p => ({ ...p, organization_id: organizationId }));
      const { data, error } = await supabase
        .from("players")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Omit<PlayerUpdate, "id" | "organization_id"> }) => {
      const { error } = await supabase.from("players").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}
