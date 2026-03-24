import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import PlayerCard from "@/components/PlayerCard";
import { mockPlayers, getAgeGroup } from "@/lib/mock-data";
import { Search } from "lucide-react";

export default function Players() {
  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState<string>("all");

  const ageGroups = useMemo(() => {
    const groups = [...new Set(mockPlayers.map(p => getAgeGroup(p.dateOfBirth)))];
    return groups.sort();
  }, []);

  const filtered = useMemo(() => {
    return mockPlayers.filter(p => {
      const matchesSearch = search === "" ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        p.jerseyNumber.toString().includes(search);
      const matchesAge = ageFilter === "all" || getAgeGroup(p.dateOfBirth) === ageFilter;
      return matchesSearch && matchesAge;
    });
  }, [search, ageFilter]);

  return (
    <AppLayout>
      <div className="container py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Players</h1>
          <p className="text-sm text-muted-foreground mt-1">{mockPlayers.length} players registered</p>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or jersey #"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Age Group Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setAgeFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              ageFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            }`}
          >
            All Ages
          </button>
          {ageGroups.map(ag => (
            <button
              key={ag}
              onClick={() => setAgeFilter(ag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                ageFilter === ag ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
              }`}
            >
              {ag}
            </button>
          ))}
        </div>

        {/* Player List */}
        <div className="space-y-2">
          {filtered.map((player, i) => (
            <PlayerCard key={player.id} player={player} index={i} />
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No players found
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
