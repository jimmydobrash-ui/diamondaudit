import { useState, useEffect, useCallback } from "react";
import EvaluationTimer from "./EvaluationTimer";

interface EvaluationNumberInputProps {
  label: string;
  value: number | null;
  unit: string;
  onChange: (value: number | null) => void;
}

export default function EvaluationNumberInput({ label, value, unit, onChange }: EvaluationNumberInputProps) {
  const [localValue, setLocalValue] = useState(value !== null && value !== undefined ? String(value) : "");

  // Reflect external value changes (e.g. saved scores loading in after mount),
  // but don't clobber an in-progress entry like "6." — compare parsed values.
  useEffect(() => {
    const current = localValue.trim() === "" ? null : parseFloat(localValue);
    if (current !== value) {
      setLocalValue(value !== null && value !== undefined ? String(value) : "");
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    if (raw === "") {
      onChange(null);
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num)) onChange(num);
    }
  }, [onChange]);

  // Timed drills (seconds) get a built-in stopwatch; stopping fills this field.
  const isTimed = unit === "sec";
  const applyTimer = useCallback((seconds: number) => {
    setLocalValue(String(seconds));
    onChange(seconds);
  }, [onChange]);

  return (
    <div className="touch-target py-1">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-24 flex-shrink-0">{label}</span>
        <div className="flex-1 flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            value={localValue}
            onChange={handleChange}
            placeholder="—"
            className="w-full h-9 bg-secondary rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-muted-foreground w-8 flex-shrink-0">{unit}</span>
        </div>
      </div>
      {isTimed && <EvaluationTimer onCapture={applyTimer} />}
    </div>
  );
}
