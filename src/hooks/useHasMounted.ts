import { useEffect, useRef } from "react";

// Ref flips to true right after first mount. Use it to skip re-playing
// per-item entrance animations (initial/delay) on re-renders triggered by
// filtering or tab switches, so those interactions feel instant instead of
// re-staggering through the whole list.
export function useHasMounted() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = true;
  }, []);
  return ref;
}
