import { useEffect, useRef, useState } from "react";

// Anima un numero dal suo valore precedente fino a `target` con un ease-out,
// per dare un minimo di "vita" a budget/punteggi che cambiano.
export function useCountUp(target: number, durataMs = 700, partenzaIniziale?: number): number {
  const [valore, setValore] = useState(partenzaIniziale ?? target);
  const partenzaRef = useRef(partenzaIniziale ?? target);

  useEffect(() => {
    const partenza = partenzaRef.current;
    const delta = target - partenza;
    if (delta === 0) return;

    let frame: number;
    const inizio = performance.now();

    function tick(ora: number) {
      const t = Math.min(1, (ora - inizio) / durataMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setValore(partenza + delta * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        partenzaRef.current = target;
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durataMs]);

  return valore;
}
