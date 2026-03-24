import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Player, getPlayingAge, getAgeGroup, getOverallScore } from "@/lib/mock-data";
import { ChevronRight } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  index: number;
}

export default function PlayerCard({ player, index }: PlayerCardProps) {
  const navigate = useNavigate();
  const overallScore = getOverallScore(player.id);
  const ageGroup = getAgeGroup(player.dateOfBirth);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onClick={() => navigate(`/evaluate/${player.id}`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all text-left group"
    >
      {/* Jersey Number */}
      <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-bold text-foreground">#{player.jerseyNumber}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">
            {player.firstName} {player.lastName}
          </span>
          {player.tags.includes('Top Prospect') && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
              TOP
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{ageGroup}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground">{player.positions.join(', ')}</span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground">B:{player.bats} T:{player.throws}</span>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {overallScore > 0 && (
          <div className={`text-lg font-bold ${overallScore >= 8 ? 'text-primary' : overallScore >= 6 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {overallScore}
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.button>
  );
}
