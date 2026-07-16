import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { CartaBonus, Giocatore, Giornata, RosaGiocatore, Squadra } from "../api/types";
import PlayerCard from "../components/PlayerCard";
import PackOpening, { type FaseApertura } from "../components/PackOpening";
import Confetti from "../components/Confetti";
import GiocatoreStatsModal from "../components/GiocatoreStatsModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useCountUp } from "../hooks/useCountUp";
import { useToast } from "../context/ToastContext";

const DURATA_MIN_SHAKE_MS = 1100;

export default function SquadraPage() {
  useDocumentTitle("La mia squadra");
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [squadra, setSquadra] = useState<Squadra | null>(null);
  const [rosa, setRosa] = useState<RosaGiocatore[]>([]);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [carte, setCarte] = useState<CartaBonus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fasePacchetto, setFasePacchetto] = useState<FaseApertura>("idle");
  const [cartaRivelata, setCartaRivelata] = useState<Giocatore | null>(null);
  const [festaId, setFestaId] = useState(0);
  const [giocatoreSelezionato, setGiocatoreSelezionato] = useState<string | null>(null);

  const cartebonusAttive = squadra?.lega?.cartebonusAttive ?? true;

  const ricarica = useCallback(async () => {
    if (!id) return;
    try {
      const [sq, r, g] = await Promise.all([
        apiFetch<Squadra>(`/squadre/${id}`),
        apiFetch<RosaGiocatore[]>(`/squadre/${id}/rosa`),
        apiFetch<Giornata[]>(`/giornate?stagione=2025/26`),
      ]);
      setSquadra(sq);
      setRosa(r);
      setGiornate(g);
      if (sq.lega?.cartebonusAttive ?? true) {
        setCarte(await apiFetch<CartaBonus[]>(`/squadre/${id}/carte`));
      } else {
        setCarte([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento della squadra");
    }
  }, [id]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  const budgetSpesoReale = rosa.reduce((acc, r) => acc + r.prezzoPagato, 0);
  const budgetSpeso = useCountUp(budgetSpesoReale);
  const giornataCorrente = giornate.find((g) => g.stato !== "CONCLUSA") ?? giornate[0];

  const pacchettoGiaAperto = useMemo(
    () => (giornataCorrente ? carte.some((c) => c.giornataAperturaId === giornataCorrente.id) : false),
    [carte, giornataCorrente]
  );
  const carteInAttesa = carte.filter((c) => c.stato === "PENDING");
  const carteUsate = carte.filter((c) => c.stato === "USATA");

  async function attendi(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function apriPacchetto() {
    if (!id || !giornataCorrente) return;
    setError(null);
    setCartaRivelata(null);
    setFasePacchetto("shaking");
    const inizio = Date.now();
    try {
      const carta = await apiFetch<CartaBonus>(`/squadre/${id}/pacchetto`, { method: "POST", body: { giornataId: giornataCorrente.id } });
      const trascorso = Date.now() - inizio;
      if (trascorso < DURATA_MIN_SHAKE_MS) await attendi(DURATA_MIN_SHAKE_MS - trascorso);
      setCartaRivelata(carta.giocatore);
      setFasePacchetto("rivelata");
      setFestaId((f) => f + 1);
      await ricarica();
    } catch (err) {
      setFasePacchetto("idle");
      showToast(err instanceof ApiError ? err.message : "Errore nell'apertura del pacchetto", "error");
    }
  }

  return (
    <div>
      {fasePacchetto === "rivelata" && <Confetti burstId={festaId} />}
      <h2>La mia squadra</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="card flex-between">
        <div>
          <p className="muted">
            Budget speso: <strong className="tabular">{Math.round(budgetSpeso)}</strong>
          </p>
          <p className="muted">Giocatori in rosa: {rosa.length}</p>
        </div>
        {giornataCorrente && (
          <Link to={`/formazione/${id}/${giornataCorrente.id}`}>
            <button>Schiera formazione (giornata {giornataCorrente.numero})</button>
          </Link>
        )}
      </div>

      {cartebonusAttive && (
        <div className="card">
          <div className="flex-between">
            <div>
              <h3 style={{ marginBottom: "0.25rem" }}>Pacchetto settimanale</h3>
              <p className="muted" style={{ margin: 0 }}>
                Una volta a giornata puoi aprire un pacchetto: estrae a caso un "campioncino" dalla tua rosa. Se lo
                schieri titolare in quella giornata riceve <strong>+1</strong> al voto finale; se non gioca, la carta
                resta valida e si attiva alla prima giornata in cui lo schieri.
              </p>
            </div>
            {giornataCorrente && (
              <button disabled={pacchettoGiaAperto || fasePacchetto !== "idle"} onClick={apriPacchetto}>
                {pacchettoGiaAperto
                  ? "Pacchetto gia' aperto"
                  : fasePacchetto === "shaking"
                    ? "Apertura..."
                    : `Apri pacchetto (giornata ${giornataCorrente.numero})`}
              </button>
            )}
          </div>

          <PackOpening fase={fasePacchetto} giocatore={cartaRivelata} />
          {fasePacchetto === "rivelata" && cartaRivelata && (
            <p className="muted" style={{ textAlign: "center", marginTop: "-0.25rem" }}>
              Hai trovato <strong style={{ color: "var(--text)" }}>{cartaRivelata.nome}</strong>!
            </p>
          )}

          {carteInAttesa.length > 0 && (
            <>
              <h4 className="muted" style={{ marginBottom: "0.5rem" }}>
                Carte bonus in attesa
              </h4>
              <div className="player-card-grid">
                {carteInAttesa.map((c, i) => (
                  <PlayerCard key={c.id} index={i} giocatore={c.giocatore} hasBonus size="sm" />
                ))}
              </div>
            </>
          )}

          {carteUsate.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary className="muted" style={{ cursor: "pointer" }}>
                Carte gia' utilizzate ({carteUsate.length})
              </summary>
              <div className="player-card-grid" style={{ marginTop: "0.75rem" }}>
                {carteUsate.map((c, i) => (
                  <PlayerCard key={c.id} index={i} giocatore={c.giocatore} size="sm" />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>Rosa</h3>
          <Link to={`/leghe/${squadra?.legaId}/mercato`}>
            <button className="secondary">Vai al Mercato</button>
          </Link>
        </div>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Solo l'amministratore della lega puo' assegnare o togliere giocatori dalle rose. Per ottenere nuovi
          giocatori o proporre uno scambio con un altro partecipante, usa la sezione Mercato.
        </p>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Squadra</th>
              <th>Prezzo</th>
            </tr>
          </thead>
          <tbody>
            {rosa.map((r) => (
              <tr key={r.id}>
                <td>
                  <button type="button" className="link-button" onClick={() => setGiocatoreSelezionato(r.giocatoreId)}>
                    {r.giocatore.nome}
                  </button>
                </td>
                <td>
                  <span className={`badge ruolo-${r.giocatore.ruolo}`}>{r.giocatore.ruolo}</span>
                </td>
                <td>{r.giocatore.squadraSerieA}</td>
                <td>{r.prezzoPagato}</td>
              </tr>
            ))}
            {rosa.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nessun giocatore in rosa. L'admin della lega puo' assegnartene dal Mercato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {giocatoreSelezionato && (
        <GiocatoreStatsModal giocatoreId={giocatoreSelezionato} onClose={() => setGiocatoreSelezionato(null)} />
      )}
    </div>
  );
}
