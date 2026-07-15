import type { Giocatore } from "../api/types";

const RUOLO_LABEL: Record<string, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };

interface PlayerCardProps {
  giocatore: Giocatore;
  slot?: "TITOLARE" | "PANCHINA" | null;
  hasBonus?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export default function PlayerCard({ giocatore, slot, hasBonus, onClick, disabled, size = "md" }: PlayerCardProps) {
  const iniziali = giocatore.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    <button type="button" className={classi} onClick={onClick} disabled={disabled} title={`${giocatore.nome} - ${RUOLO_LABEL[giocatore.ruolo]}`}>
      {hasBonus && <span className="player-card-bonus">+1</span>}
      <div className="player-card-top">
        <span className="player-card-rating">{giocatore.quotazione ?? "-"}</span>
        <span className="player-card-ruolo">{giocatore.ruolo}</span>
      </div>
      <div className="player-card-avatar">{iniziali}</div>
      <div className="player-card-bottom">
        <div className="player-card-nome">{giocatore.nome}</div>
        <div className="player-card-squadra">{giocatore.squadraSerieA}</div>
      </div>
      {slot && <span className={`player-card-slot ${slot === "TITOLARE" ? "slot-titolare" : "slot-panchina"}`}>{slot === "TITOLARE" ? "Titolare" : "Panchina"}</span>}
    </button>
  );
}
