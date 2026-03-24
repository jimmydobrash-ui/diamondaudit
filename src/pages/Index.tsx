import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { mockPlayers, getOverallScore, getAgeGroup } from "@/lib/mock-data";
import { Users, ClipboardList, BarChart3, TrendingUp } from "lucide-react";

const stats = [
  { label: "Players", value: mockPlayers.length, icon: Users },
  { label: "Evaluated", value: mockPlayers.filter(p => getOverallScore(p.id) > 0).length, icon: ClipboardList },
  { label: "Avg Score", value: (mockPlayers.reduce((acc, p) => acc + getOverallScore(p.id), 0) / mockPlayers.length).toFixed(1), icon: BarChart3 },
  { label: "Top Score", value: Math.max(...mockPlayers.map(p => getOverallScore(p.id))).toFixed(1), icon: TrendingUp },
];

export default function Index() {
  const topPlayers = [...mockPlayers]
    .sort((a, b) => getOverallScore(b.id) - getOverallScore(a.id))
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Spring Tryouts 2026</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="p-4 rounded-xl bg-card card-elevated"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/players"
            className="p-4 rounded-xl bg-primary text-primary-foreground card-elevated flex flex-col gap-1"
          >
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold mt-1">View Players</span>
            <span className="text-xs opacity-80">Browse roster</span>
          </Link>
          <Link
            to="/evaluate"
            className="p-4 rounded-xl bg-foreground text-background card-elevated flex flex-col gap-1"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-semibold mt-1">Start Evaluating</span>
            <span className="text-xs opacity-80">Score players</span>
          </Link>
        </div>

        {/* Top Players */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Top Players</h2>
            <Link to="/leaderboard" className="text-xs text-primary font-medium">View All</Link>
          </div>
          <div className="space-y-2">
            {topPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <Link
                  to={`/evaluate/${player.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card card-elevated hover:bg-secondary/50 transition-all"
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="text-sm font-bold">#{player.jerseyNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">
                      {player.firstName} {player.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{getAgeGroup(player.dateOfBirth)} · {player.positions.join(', ')}</span>
                  </div>
                  <span className="text-lg font-bold text-primary">{getOverallScore(player.id)}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
