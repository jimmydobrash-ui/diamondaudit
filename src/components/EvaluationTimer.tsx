import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, RotateCcw } from "lucide-react";

interface EvaluationTimerProps {
  /** Called with the elapsed seconds (2dp) when the coach stops the timer. */
  onCapture: (seconds: number) => void;
}

// A one-thumb stopwatch for timed drills (home-to-1st, 60-yard, pop time).
// Deliberately BIG: on a field, a small stop button that misfires means a wrong
// time gets saved to a player, so the primary action is a full-width, tall,
// color-coded button (green Start / red Stop) that's hard to miss. Reset is
// small and separated so it can't be fat-fingered — and it only clears the
// readout, never the captured value already in the field.
export default function EvaluationTimer({ onCapture }: EvaluationTimerProps) {
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(0); // seconds shown on the readout
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Stop any running interval if the component unmounts (category/player change).
  useEffect(() => clearTick, [clearTick]);

  const start = useCallback(() => {
    startRef.current = performance.now();
    setDisplay(0);
    setRunning(true);
    clearTick();
    // Refresh the readout ~30x/sec; the value is always derived from
    // performance.now() so it can't drift, and the captured time on stop is
    // computed the same way independent of these ticks.
    intervalRef.current = window.setInterval(() => {
      if (startRef.current !== null) {
        setDisplay((performance.now() - startRef.current) / 1000);
      }
    }, 33);
  }, [clearTick]);

  const stop = useCallback(() => {
    clearTick();
    setRunning(false);
    if (startRef.current === null) return;
    const seconds = Math.round(((performance.now() - startRef.current) / 1000) * 100) / 100;
    setDisplay(seconds);
    onCapture(seconds);
  }, [clearTick, onCapture]);

  const reset = useCallback(() => {
    clearTick();
    setRunning(false);
    startRef.current = null;
    setDisplay(0);
  }, [clearTick]);

  const canReset = !running && !(display === 0 && startRef.current === null);

  return (
    <div className="mt-3">
      <div className="text-center mb-2 leading-none">
        <span className="text-5xl font-bold tabular-nums tracking-tight text-foreground">{display.toFixed(2)}</span>
        <span className="text-base text-muted-foreground ml-1.5">sec</span>
      </div>
      <button
        type="button"
        onClick={running ? stop : start}
        aria-label={running ? "Stop timer" : "Start timer"}
        className={`w-full h-24 rounded-2xl font-bold text-2xl flex items-center justify-center gap-3 transition-colors active:brightness-95 ${
          running
            ? "bg-primary text-primary-foreground"
            : "bg-success text-success-foreground"
        }`}
      >
        {running ? <Square className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        {running ? "Stop" : "Start"}
      </button>
      <div className="flex justify-center mt-2">
        <button
          type="button"
          onClick={reset}
          disabled={!canReset}
          aria-label="Reset timer"
          className="h-9 px-5 rounded-lg text-sm font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
    </div>
  );
}
