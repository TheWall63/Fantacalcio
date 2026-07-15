import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Giocatore } from "../api/types";
import PlayerCard from "./PlayerCard";

export type FaseApertura = "idle" | "shaking" | "rivelata";

interface PackOpeningProps {
  fase: FaseApertura;
  giocatore: Giocatore | null;
}

function useSparkles(seed: string | undefined, quanti: number) {
  return useMemo(() => {
    return Array.from({ length: quanti }, (_, i) => {
      const angolo = (i / quanti) * Math.PI * 2 + Math.random() * 0.4;
      const raggio = 70 + Math.random() * 40;
      return {
        x: `${Math.cos(angolo) * raggio}px`,
        y: `${Math.sin(angolo) * raggio}px`,
        delay: Math.round(Math.random() * 180),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
}

export default function PackOpening({ fase, giocatore }: PackOpeningProps) {
  const sparkles = useSparkles(giocatore?.id, 12);

  if (fase === "idle") return null;

  return (
    <div className="reveal-stage">
      {fase === "shaking" && (
        <div className="pack-box shaking">
          <div className="pack-box-stars" />
          <div className="pack-box-shine" />
          <span className="pack-box-glyph">🎁</span>
        </div>
      )}

      {fase === "rivelata" && giocatore && (
        <div className="reveal-card-wrap">
          <div className="reveal-burst" />
          {sparkles.map((s, i) => (
            <span
              key={i}
              className="sparkle"
              style={{ "--sx": s.x, "--sy": s.y, animationDelay: `${s.delay}ms` } as CSSProperties}
            />
          ))}
          <PlayerCard giocatore={giocatore} hasBonus />
        </div>
      )}
    </div>
  );
}
