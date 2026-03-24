import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAddPlayer } from "@/hooks/usePlayers";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const POSITION_OPTIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "IF"];

export default function AddPlayer() {
  const navigate = useNavigate();
  const addPlayer = useAddPlayer();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    positions: [] as string[],
    bats: "R" as string,
    throws: "R" as string,
    height: "",
    weight: "" as string,
    jersey_number: "" as string,
    notes: "",
  });

  const togglePosition = (pos: string) => {
    setForm(prev => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter(p => p !== pos)
        : [...prev.positions, pos],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth) {
      toast.error("Name and date of birth are required");
      return;
    }

    try {
      await addPlayer.mutateAsync({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth,
        positions: form.positions,
        bats: form.bats,
        throws: form.throws,
        height: form.height || null,
        weight: form.weight ? Number(form.weight) : null,
        jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
        notes: form.notes,
      });
      toast.success("Player added!");
      navigate("/players");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/players")} className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Add Player</h1>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">First Name *</label>
              <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} required maxLength={100} className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Last Name *</label>
              <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} required maxLength={100} className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Birth *</label>
              <input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} required className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Jersey #</label>
              <input type="number" value={form.jersey_number} onChange={e => setForm(p => ({ ...p, jersey_number: e.target.value }))} min={0} max={99} className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Positions</label>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_OPTIONS.map(pos => (
                <button key={pos} type="button" onClick={() => togglePosition(pos)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    form.positions.includes(pos) ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  }`}
                >{pos}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Bats</label>
              <div className="flex gap-1.5">
                {["L", "R", "S"].map(v => (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, bats: v }))}
                    className={`flex-1 h-10 rounded-lg text-xs font-medium transition-colors ${form.bats === v ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Throws</label>
              <div className="flex gap-1.5">
                {["L", "R"].map(v => (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, throws: v }))}
                    className={`flex-1 h-10 rounded-lg text-xs font-medium transition-colors ${form.throws === v ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
                  >{v}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Height</label>
              <input placeholder={`5'10"`} value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))} maxLength={10} className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Weight (lbs)</label>
              <input type="number" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} min={0} max={400} className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} maxLength={500} placeholder="Optional notes..." className="w-full h-20 p-3 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <button type="submit" disabled={addPlayer.isPending}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {addPlayer.isPending ? "Saving..." : "Add Player"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
