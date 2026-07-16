import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, ApiError } from "../api/client";
import type { StatisticheGiocatore, StatoPresenza } from "../api/types";

const RUOLO_LABEL: Record<string, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };
const PRESENZA_LABEL: Record<StatoPresenza, string> = {
  TITOLARE: "Titolare",
  SUBENTRATO: "Subentrato",
  NON_CONVOCATO: "Non ha giocato",
  INFORTUNATO: "Infortunio",
};

interface Props {
  giocatoreId: string;
  onClose: () => void;
}

export default function GiocatoreStatsModal({ giocatoreId, onClose }: Props) {
  const [dati, setDati] = useState<StatisticheGiocatore | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    setDati(null);
    setErrore(null);
    apiFetch<StatisticheGiocatore>(`/giocatori/${giocatoreId}/statistiche`)
      .then(setDati)
      .catch((err) => setErrore(err instanceof ApiError ? err.message : "Errore nel caricamento delle statistiche"));
  }, [giocatoreId]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const iniziali = dati?.giocatore.nome
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
          ✕
        </button>

        {errore && <div className="error-box">{errore}</div>}
        {!dati && !errore && <p className="muted">Caricamento...</p>}

        {dati && (
          <>
            <div className="modal-player-header">
              <div className={`modal-player-avatar ruolo-bg-${dati.giocatore.ruolo}`}>
                {dati.giocatore.immagineUrl ? <img src={dati.giocatore.immagineUrl} alt="" /> : <span>{iniziali}</span>}
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{dati.giocatore.nome}</h3>
                <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                  <span className={`badge ruolo-${dati.giocatore.ruolo}`}>{dati.giocatore.ruolo}</span>{" "}
                  {RUOLO_LABEL[dati.giocatore.ruolo]} &middot; {dati.giocatore.squadraSerieA}
                  {dati.giocatore.quotazione != null && <> &middot; Quotazione {dati.giocatore.quotazione}</>}
                </p>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-tile">
                <strong>{dati.statistiche.gol}</strong>
                <span>Gol</span>
              </div>
              <div className="stat-tile">
                <strong>{dati.statistiche.assist}</strong>
                <span>Assist</span>
              </div>
              <div className="stat-tile">
                <strong>{dati.statistiche.rigoriSegnati}</strong>
                <span>Rigori segnati</span>
              </div>
              <div className="stat-tile">
                <strong>{dati.statistiche.rigoriSbagliati}</strong>
                <span>Rigori sbagliati</span>
              </div>
              <div className="stat-tile">
                <strong>{dati.statistiche.partiteTotali}</strong>
                <span>Partite totali</span>
              </div>
              <div className="stat-tile">
                <strong>{dati.statistiche.partiteGiocate}</strong>
                <span>Partite giocate</span>
              </div>
            </div>

            <h4 className="muted" style={{ marginBottom: "0.6rem" }}>
              Storico partite
            </h4>
            {dati.cronologia.length === 0 ? (
              <p className="muted">Nessuna giornata ancora calcolata.</p>
            ) : (
              <>
                <div className="presenza-strip">
                  {dati.cronologia.map((c) => (
                    <span
                      key={c.giornataId}
                      className={`presenza-dot presenza-${c.presenza}`}
                      title={`Giornata ${c.numero}: ${PRESENZA_LABEL[c.presenza]}`}
                    >
                      {c.numero}
                    </span>
                  ))}
                </div>
                <div className="presenza-legend">
                  <span>
                    <i className="presenza-swatch presenza-TITOLARE" /> Titolare
                  </span>
                  <span>
                    <i className="presenza-swatch presenza-SUBENTRATO" /> Subentrato
                  </span>
                  <span>
                    <i className="presenza-swatch presenza-NON_CONVOCATO" /> Non ha giocato
                  </span>
                  <span>
                    <i className="presenza-swatch presenza-INFORTUNATO" /> Infortunio
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
