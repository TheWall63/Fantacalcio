import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { Giocatore } from "../api/types";

const TILT_MAX_DEG = 12;

const RUOLO_LABEL: Record<string, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };

interface PlayerCardProps {
  giocatore: Giocatore;
  slot?: "TITOLARE" | "PANCHINA" | null;
  hasBonus?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  index?: number;
}

export default function PlayerCard({ giocatore, slot, hasBonus, onClick, disabled, size = "md", index = 0 }: PlayerCardProps) {
  const [immagineNonCaricata, setImmagineNonCaricata] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  // Tilt 3D che segue il cursore: aggiorna le custom property CSS
  // direttamente sul nodo DOM (non via useState) per restare fluido a ogni
  // movimento del mouse senza ri-renderizzare il componente.
  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--rx", `${(px - 0.5) * TILT_MAX_DEG}deg`);
    el.style.setProperty("--ry", `${-(py - 0.5) * TILT_MAX_DEG}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }

  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  const iniziali = giocatore.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const mostraImmagine = !!giocatore.immagineUrl && !immagineNonCaricata;

  const classi = [
    "player-card",
    `ruolo-bg-${giocatore.ruolo}`,
    size === "sm" ? "player-card-sm" : "",
    slot === "TITOLARE" ? "is-titolare" : "",
    slot === "PANCHINA" ? "is-panchina" : "",
    hasBonus ? "has-bonus" : "",
    disabled ? "is-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={cardRef}
      type="button"
      className={classi}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      title={`${giocatore.nome} - ${RUOLO_LABEL[giocatore.ruolo]}`}
      style={{ "--i": Math.min(index, 14) } as CSSProperties}
    >
      {hasBonus && <span className="player-card-bonus">+1</span>}
      <div className="player-card-top">
        <span className="player-card-rating">{giocatore.quotazione ?? "-"}</span>
        <span className="player-card-ruolo">{giocatore.ruolo}</span>
      </div>
      {mostraImmagine ? (
        // Fallback automatico alle iniziali se l'URL non carica (immagine rimossa/rotta)
        <img
          className="player-card-foto"
          src={giocatore.immagineUrl!}
          alt=""
          onError={() => setImmagineNonCaricata(true)}
        />
      ) : (
        <div className="player-card-avatar">{iniziali}</div>
      )}
      <div className="player-card-bottom">
        <div className="player-card-nome">{giocatore.nome}</div>
        <div className="player-card-squadra">{giocatore.squadraSerieA}</div>
      </div>
      {slot && <span className={`player-card-slot ${slot === "TITOLARE" ? "slot-titolare" : "slot-panchina"}`}>{slot === "TITOLARE" ? "Titolare" : "Panchina"}</span>}
    </button>
  );
}
