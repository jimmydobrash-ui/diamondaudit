import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";

interface EvaluationSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export default function EvaluationSlider({ label, value, onChange }: EvaluationSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  // Reflect external value changes (e.g. saved scores loading in after mount).
  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = useCallback((vals: number[]) => {
    const v = vals[0];
    setLocalValue(v);
    onChange(v);
  }, [onChange]);

  const getColor = (val: number) => {
    if (val >= 8) return 'text-primary font-bold';
    if (val >= 6) return 'text-foreground font-semibold';
    if (val >= 4) return 'text-muted-foreground font-semibold';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-center gap-3 touch-target py-1">
      <span className="text-sm text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <div className="flex-1">
        <Slider
          value={[localValue]}
          onValueChange={handleChange}
          min={1}
          max={10}
          step={0.5}
          className="w-full"
        />
      </div>
      <span className={`text-sm w-8 text-right tabular-nums ${getColor(localValue)}`}>
        {localValue.toFixed(1)}
      </span>
    </div>
  );
}
