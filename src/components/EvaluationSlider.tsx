import { useState, useEffect, useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface EvaluationSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const MIN = 1;
const MAX = 10;
const STEP = 0.5;

export default function EvaluationSlider({ label, value, onChange }: EvaluationSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  // Reflect external value changes (e.g. saved scores loading in after mount).
  useEffect(() => { setLocalValue(value); }, [value]);

  // Snap to the 0.5 grid and clamp to 1–10 for both the slider and the steppers,
  // so repeated ± taps can't drift off-step or past the ends.
  const commit = useCallback((next: number) => {
    const snapped = Math.round(next * 2) / 2;
    const clamped = Math.min(MAX, Math.max(MIN, snapped));
    setLocalValue(clamped);
    onChange(clamped);
  }, [onChange]);

  const handleSliderChange = useCallback((vals: number[]) => {
    commit(vals[0]);
  }, [commit]);

  const getColor = (val: number) => {
    if (val >= 8) return 'text-primary font-bold';
    if (val >= 6) return 'text-foreground font-semibold';
    if (val >= 4) return 'text-muted-foreground font-semibold';
    return 'text-muted-foreground';
  };

  // Label + value on their own line, then big ± targets flanking the slider —
  // fits a 375px phone without crowding the track, and gives precise control
  // that a bare slider was too finicky to provide by touch on the field.
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-sm tabular-nums ${getColor(localValue)}`}>{localValue.toFixed(1)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => commit(localValue - STEP)}
          disabled={localValue <= MIN}
          className="w-11 h-11 flex-shrink-0 rounded-lg bg-secondary text-foreground flex items-center justify-center active:bg-secondary/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Minus className="w-4 h-4" />
        </button>
        <Slider
          value={[localValue]}
          onValueChange={handleSliderChange}
          min={MIN}
          max={MAX}
          step={STEP}
          aria-label={label}
          className="flex-1"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => commit(localValue + STEP)}
          disabled={localValue >= MAX}
          className="w-11 h-11 flex-shrink-0 rounded-lg bg-secondary text-foreground flex items-center justify-center active:bg-secondary/60 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
