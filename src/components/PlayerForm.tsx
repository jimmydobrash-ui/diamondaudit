import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import type { Player } from "@/hooks/usePlayers";

const POSITION_OPTIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "IF"];

export interface PlayerFormValues {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  positions: string[];
  bats: string;
  throws: string;
  height: string;
  weight: string;
  jersey_number: string;
  notes: string;
}

export const emptyPlayerForm: PlayerFormValues = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  positions: [],
  bats: "R",
  throws: "R",
  height: "",
  weight: "",
  jersey_number: "",
  notes: "",
};

/** Map a DB player row to editable form values. */
export function playerToFormValues(p: Player): PlayerFormValues {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    positions: p.positions ?? [],
    bats: p.bats,
    throws: p.throws,
    height: p.height ?? "",
    weight: p.weight != null ? String(p.weight) : "",
    jersey_number: p.jersey_number != null ? String(p.jersey_number) : "",
    notes: p.notes ?? "",
  };
}

/** Map form values to a players insert/update payload (numbers coerced, blanks → null). */
export function playerFormToPayload(v: PlayerFormValues) {
  return {
    first_name: v.first_name.trim(),
    last_name: v.last_name.trim(),
    date_of_birth: v.date_of_birth,
    positions: v.positions,
    bats: v.bats,
    throws: v.throws,
    height: v.height || null,
    weight: v.weight ? Number(v.weight) : null,
    jersey_number: v.jersey_number ? Number(v.jersey_number) : null,
    notes: v.notes,
  };
}

interface Props {
  initial?: PlayerFormValues;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: PlayerFormValues) => void;
}

export default function PlayerForm({ initial, submitting, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<PlayerFormValues>(initial ?? emptyPlayerForm);

  const togglePosition = (pos: string) => {
    setForm(prev => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter(p => p !== pos)
        : [...prev.positions, pos],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth) {
      toast.error("Name and date of birth are required");
      return;
    }
    onSubmit(form);
  };

  return (
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

      <button type="submit" disabled={submitting}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
