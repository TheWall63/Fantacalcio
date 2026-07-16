import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { Lega } from "../api/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../context/ToastContext";

const MODULI = ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1"];

export default function LegaSetupPage() {
  useDocumentTitle("Configura lega");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [lega, setLega] = useState<Lega | null>(null);
  const [moduli, setModuli] = useState<Set<string>>(new Set(MODULI));
  const [modificatoreDifesa, setModificatoreDifesa] = useState(false);
  const [bonusMvp, setBonusMvp] = useState(false);
  const [cartebonusAttive, setCartebonusAttive] = useState(true);
  const [modalitaClassifica, setModalitaClassifica] = useState<"SCONTRI_DIRETTI" | "PUNTI">("SCONTRI_DIRETTI");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<Lega>(`/leghe/${id}`).then((l) => {
      setLega(l);
      setModuli(new Set(l.moduliConsentiti.length > 0 ? l.moduliConsentiti : MODULI));
      setModificatoreDifesa(l.modificatoreDifesa);
      setBonusMvp(l.bonusMvp);
      setCartebonusAttive(l.cartebonusAttive);
      setModalitaClassifica(l.modalitaClassifica);
    });
  }, [id]);

  function toggleModulo(m: string) {
    const next = new Set(moduli);
    if (next.has(m)) {
      if (next.size > 1) next.delete(m);
    } else {
      next.add(m);
    }
    setModuli(next);
  }

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/leghe/${id}/impostazioni`, {
        method: "PATCH",
        body: {
          moduliConsentiti: Array.from(moduli),
          modificatoreDifesa,
          bonusMvp,
          cartebonusAttive,
          modalitaClassifica,
        },
      });
      showToast("Impostazioni della lega salvate!");
      navigate(`/leghe/${id}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nel salvataggio delle impostazioni", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!lega) return null;

  return (
    <div>
      <h2>Configura "{lega.nome}"</h2>
      <p className="muted">
        Ultimo passo prima di iniziare: scegli le regole della tua lega. Potrai cambiarle in qualsiasi momento da qui.
      </p>
      {error && <div className="error-box">{error}</div>}

      <form onSubmit={salva}>
        <div className="card">
          <h3>Moduli utilizzabili</h3>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            Gli schemi classici del fantacalcio ammessi in questa lega quando i partecipanti schierano la formazione.
          </p>
          <div className="chip-grid">
            {MODULI.map((m) => (
              <button type="button" key={m} className={`chip ${moduli.has(m) ? "selected" : ""}`} onClick={() => toggleModulo(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Modalità classifica</h3>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            Scegline una: come si stabilisce chi vince la lega.
          </p>
          <div className="choice-grid">
            <button
              type="button"
              className={`choice-card ${modalitaClassifica === "SCONTRI_DIRETTI" ? "selected" : ""}`}
              onClick={() => setModalitaClassifica("SCONTRI_DIRETTI")}
            >
              <strong>Scontri diretti</strong>
              <span className="muted">
                Ogni giornata i partecipanti si sfidano uno contro uno (calendario a girone all'italiana). Vince la
                lega chi fa più punti-partita (3 per vittoria, 1 per pareggio), come nel calcio vero.
              </span>
            </button>
            <button
              type="button"
              className={`choice-card ${modalitaClassifica === "PUNTI" ? "selected" : ""}`}
              onClick={() => setModalitaClassifica("PUNTI")}
            >
              <strong>Modalità a punti</strong>
              <span className="muted">
                Nessuno scontro diretto: vince chi somma più fantapunti con i propri giocatori alla fine del
                campionato (classifica cumulativa stile Leghe FC).
              </span>
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Regole di punteggio</h3>
          <div className="switch-row">
            <div className="switch-row-text">
              <strong>Modificatore difesa</strong>
              <span className="muted">
                Bonus/malus alla formazione in base alla media voto di portiere e difensori titolari (stile Leghe FC).
              </span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={modificatoreDifesa} onChange={(e) => setModificatoreDifesa(e.target.checked)} />
              <span className="switch-slider" />
            </label>
          </div>
          <div className="switch-row">
            <div className="switch-row-text">
              <strong>Bonus MVP di giornata</strong>
              <span className="muted">Chi schiera titolare il miglior voto della giornata riceve +1 punto in più.</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={bonusMvp} onChange={(e) => setBonusMvp(e.target.checked)} />
              <span className="switch-slider" />
            </label>
          </div>
          <div className="switch-row">
            <div className="switch-row-text">
              <strong>Modalità carte bonus</strong>
              <span className="muted">
                Apertura del pacchetto settimanale "campioncino" (+1 al giocatore estratto). Se disattivata si gioca in
                modalità classica, senza pacchetti.
              </span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={cartebonusAttive} onChange={(e) => setCartebonusAttive(e.target.checked)} />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        <button type="submit" disabled={busy}>
          Salva e vai alla lega
        </button>
      </form>
    </div>
  );
}
