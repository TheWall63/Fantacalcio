import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { CartaBonus, Giocatore, Giornata, RosaGiocatore } from "../api/types";
import PlayerCard from "../components/PlayerCard";
import PackOpening, { type FaseApertura } from "../components/PackOpening";
import Confetti from "../components/Confetti";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useCountUp } from "../hooks/useCountUp";
import { useToast } from "../context/ToastContext";

const DURATA_MIN_SHAKE_MS = 1100;

export default function SquadraPage() {
  useDocumentTitle("La mia squadra");
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [rosa, setRosa] = useState<RosaGiocatore[]>([]);
  const [svincolati, setSvincolati] = useState<Giocatore[]>([]);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [carte, setCarte] = useState<CartaBonus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [prezzi, setPrezzi] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [fasePacchetto, setFasePacchetto] = useState<FaseApertura>("idle");
  const [cartaRivelata, setCartaRivelata] = useState<Giocatore | null>(null);
  const [festaId, setFestaId] = useState(0);

  const ricarica = useCallback(async () => {
    if (!id) return;
    try {
      const [r, s, g, c] = await Promise.all([
        apiFetch<RosaGiocatore[]>(`/squadre/${id}/rosa`),
        apiFetch<Giocatore[]>(`/squadre/${id}/svincolati`),
        apiFetch<Giornata[]>(`/giornate?stagione=2025/26`),
        apiFetch<CartaBonus[]>(`/squadre/${id}/carte`),
      ]);
      setRosa(r);
      setSvincolati(s);
      setGiornate(g);
      setCarte(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento della squadra");
    }
  }, [id]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  const budgetSpesoReale = rosa.reduce((acc, r) => acc + r.prezzoPagato, 0);
  const budgetSpeso = useCountUp(budgetSpesoReale);
  const svincolatiFiltrati = svincolati.filter((g) => g.nome.toLowerCase().includes(q.toLowerCase()));
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

  async function acquista(giocatoreId: string) {
    if (!id) return;
    const giocatore = svincolati.find((g) => g.id === giocatoreId);
    const suggerito = giocatore?.quotazione ?? 1;
    const prezzo = prezzi[giocatoreId] ?? suggerito;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/squadre/${id}/rosa`, { method: "POST", body: { giocatoreId, prezzo } });
      showToast(`${giocatore?.nome ?? "Giocatore"} acquistato per ${prezzo} crediti.`);
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nell'acquisto", "error");
    } finally {
      setBusy(false);
    }
  }

  async function svincola(rosaId: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/squadre/${id}/rosa/${rosaId}`, { method: "DELETE" });
      showToast("Giocatore svincolato.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nello svincolo", "error");
    } finally {
      setBusy(false);
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

      <div className="grid cols-2">
        <div className="card">
          <h3>Rosa</h3>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ruolo</th>
                <th>Squadra</th>
                <th>Prezzo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rosa.map((r) => (
                <tr key={r.id}>
                  <td>{r.giocatore.nome}</td>
                  <td>
                    <span className={`badge ruolo-${r.giocatore.ruolo}`}>{r.giocatore.ruolo}</span>
                  </td>
                  <td>{r.giocatore.squadraSerieA}</td>
                  <td>{r.prezzoPagato}</td>
                  <td>
                    <button className="danger" disabled={busy} onClick={() => svincola(r.id)}>
                      Svincola
                    </button>
                  </td>
                </tr>
              ))}
              {rosa.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Nessun giocatore in rosa. Fai un'offerta dal mercato qui accanto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Mercato (svincolati)</h3>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            La colonna "Quotazione" e' un valore approssimativo di partenza (non il listone ufficiale): puoi
            modificare liberamente il prezzo dell'offerta prima di acquistare.
          </p>
          <div className="form-row">
            <input placeholder="Cerca giocatore..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ruolo</th>
                <th>Quotazione</th>
                <th>Offerta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {svincolatiFiltrati.slice(0, 50).map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.nome} <span className="muted">({g.squadraSerieA})</span>
                  </td>
                  <td>
                    <span className={`badge ruolo-${g.ruolo}`}>{g.ruolo}</span>
                  </td>
                  <td>{g.quotazione ?? <span className="muted">n/d</span>}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      style={{ width: "70px" }}
                      value={prezzi[g.id] ?? g.quotazione ?? 1}
                      onChange={(e) => setPrezzi({ ...prezzi, [g.id]: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <button disabled={busy} onClick={() => acquista(g.id)}>
                      Acquista
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
