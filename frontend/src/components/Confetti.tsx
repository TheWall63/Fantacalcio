import { useMemo } from "react";
import type { CSSProperties } from "react";

interface ConfettiProps {
  // Cambia ad ogni "esplosione" desiderata (es. un contatore incrementato):
  // rigenera i pezzi cosi' l'animazione riparte da capo.
  burstId: number | string;
  pezzi?: number;
}

const COLORI = ["#22e08f", "#38bdf8", "#7c5cff", "#fbbf24", "#f5556b"];

// Coriandoli CSS: nessuna libreria, un pugno di elementi assoluti che cadono
// ruotando con un ease-out, usati per i momenti da festeggiare (lega creata,
// squadra numero 8 iscritta, carta bonus trovata nel pacchetto...).
export default function Confetti({ burstId, pezzi = 26 }: ConfettiProps) {
  const coriandoli = useMemo(() => {
    return Array.from({ length: pezzi }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      colore: COLORI[i % COLORI.length],
      delay: Math.random() * 200,
      durata: 1400 + Math.random() * 900,
      drift: `${(Math.random() - 0.5) * 220}px`,
      rotazione: `${360 + Math.random() * 540}deg`,
      dimensione: 6 + Math.random() * 6,
      tondo: Math.random() > 0.5,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstId]);

  return (
    <div className="confetti-layer" aria-hidden="true">
      {coriandoli.map((c, i) => (
        <span
          key={`${burstId}-${i}`}
          className="confetti-piece"
          style={
            {
              left: c.left,
              background: c.colore,
              animationDelay: `${c.delay}ms`,
              animationDuration: `${c.durata}ms`,
              width: `${c.dimensione}px`,
              height: `${c.dimensione}px`,
              borderRadius: c.tondo ? "50%" : "2px",
              "--drift": c.drift,
              "--spin": c.rotazione,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
