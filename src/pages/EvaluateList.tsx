import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import PlayerCard from "@/components/PlayerCard";
import { mockPlayers } from "@/lib/mock-data";
import { ClipboardList } from "lucide-react";

export default function EvaluateList() {
  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Evaluate</h1>
          </div>
          <p className="text-sm text-muted-foreground">Tap a player to start scoring</p>
        </motion.div>

        <div className="space-y-2">
          {mockPlayers.map((player, i) => (
            <PlayerCard key={player.id} player={player} index={i} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
