import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, RotateCcw } from "lucide-react";

interface EvaluationTimerProps {
  /** Called with the elapsed seconds (2dp) when the coach stops the timer. */
  onCapture: (seconds: number) => void;
}

// A one-thumb stopwatch for timed drills (home-to-1st, 60-yard, pop time).
// Start when the runner goes, Stop when they hit the bag — stopping drops the
// time straight into the measurable field. The field stays editable, so this
// never blocks manual entry; it's just a faster way to fill it.
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

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        type="button"
        onClick={running ? stop : start}
        aria-label={running ? "Stop timer" : "Start timer"}
        className={`h-11 flex-1 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
          running
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground active:bg-secondary/70"
        }`}
      >
        {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {running ? "Stop" : "Start"}
      </button>
      <span className="w-16 text-right text-lg font-bold tabular-nums text-foreground" aria-live="off">
        {display.toFixed(2)}
      </span>
      <button
        type="button"
        onClick={reset}
        disabled={running || (display === 0 && startRef.current === null)}
        aria-label="Reset timer"
        className="w-11 h-11 flex-shrink-0 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center active:bg-secondary/70 transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}
