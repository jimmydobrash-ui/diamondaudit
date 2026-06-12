import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import PlayerForm, { playerFormToPayload, type PlayerFormValues } from "@/components/PlayerForm";
import { useAddPlayer } from "@/hooks/usePlayers";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AddPlayer() {
  const navigate = useNavigate();
  const addPlayer = useAddPlayer();

  const handleSubmit = async (values: PlayerFormValues) => {
    try {
      await addPlayer.mutateAsync(playerFormToPayload(values));
      toast.success("Player added!");
      navigate("/players");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/players")} aria-label="Back to players" className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Add Player</h1>
        </motion.div>

        <PlayerForm submitting={addPlayer.isPending} submitLabel="Add Player" onSubmit={handleSubmit} />
      </div>
    </AppLayout>
  );
}
