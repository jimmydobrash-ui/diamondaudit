import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import PlayerForm, { playerFormToPayload, playerToFormValues, type PlayerFormValues } from "@/components/PlayerForm";
import { usePlayers, useUpdatePlayer } from "@/hooks/usePlayers";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function EditPlayer() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { data: players = [], isLoading } = usePlayers();
  const updatePlayer = useUpdatePlayer();

  const player = players.find(p => p.id === playerId);

  const handleSubmit = async (values: PlayerFormValues) => {
    if (!playerId) return;
    try {
      await updatePlayer.mutateAsync({ id: playerId, updates: playerFormToPayload(values) });
      toast.success("Player updated");
      navigate(`/players/${playerId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Back" className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Edit Player</h1>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !player ? (
          <p className="py-12 text-center text-muted-foreground text-sm">Player not found</p>
        ) : (
          <PlayerForm
            initial={playerToFormValues(player)}
            submitting={updatePlayer.isPending}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AppLayout>
  );
}
