import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Giocatore, Lega, RichiestaScambio, RosaGiocatore } from "../api/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../context/ToastContext";

export default function MercatoPage() {
  useDocumentTitle("Mercato");
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lega, setLega] = useState<Lega | null>(null);
  const [rose, setRose] = useState<Record<string, RosaGiocatore[]>>({});
  const [svincolati, setSvincolati] = useState<Giocatore[]>([]);
  const [scambi, setScambi] = useState<RichiestaScambio[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [durataGiorni, setDurataGiorni] = useState(7);

  const [squadraGestitaId, setSquadraGestitaId] = useState("");
  const [qGestione, setQGestione] = useState("");
  const [prezziAssegna, setPrezziAssegna] = useState<Record<string, number>>({});

  const [squadraDestId, setSquadraDestId] = useState("");
  const [giocatoreOffertoId, setGiocatoreOffertoId] = useState("");
  const [giocatoreRichiestoId, setGiocatoreRichiestoId] = useState("");
  const [differenzaCrediti, setDifferenzaCrediti] = useState(0);

  const squadre = useMemo(() => lega?.squadre ?? [], [lega]);
  const sonoAdmin = lega?.adminId === user?.id;
  const miaSquadra = squadre.find((s) => s.userId === user?.id);
  const mercatoAttivo = !!lega?.mercatoAperto && (!lega.mercatoChiusuraAt || new Date(lega.mercatoChiusuraAt) > new Date());

  const ricarica = useCallback(async () => {
    if (!id) return;
    try {
      const l = await apiFetch<Lega>(`/leghe/${id}`);
      setLega(l);
      const elencoSquadre = l.squadre ?? [];

      const roseEntries = await Promise.all(
        elencoSquadre.map(async (s) => [s.id, await apiFetch<RosaGiocatore[]>(`/squadre/${s.id}/rosa`)] as const)
      );
      setRose(Object.fromEntries(roseEntries));

      const mia = elencoSquadre.find((s) => s.userId === user?.id);
      if (mia) {
        setSvincolati(await apiFetch<Giocatore[]>(`/squadre/${mia.id}/svincolati`));
      }

      setScambi(await apiFetch<RichiestaScambio[]>(`/scambi?legaId=${id}`));

      setSquadraGestitaId((prev) => prev || elencoSquadre[0]?.id || "");
      const primaAltraSquadra = elencoSquadre.find((s) => s.userId !== user?.id);
      setSquadraDestId((prev) => prev || primaAltraSquadra?.id || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento del mercato");
    }
  }, [id, user]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  async function apriMercato(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/leghe/${id}/mercato`, { method: "PATCH", body: { apri: true, durataGiorni } });
      showToast(`Mercato aperto per ${durataGiorni} giorni.`);
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nell'apertura del mercato", "error");
    } finally {
      setBusy(false);
    }
  }

  async function chiudiMercato() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/leghe/${id}/mercato`, { method: "PATCH", body: { apri: false } });
      showToast("Mercato chiuso.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella chiusura del mercato", "error");
    } finally {
      setBusy(false);
    }
  }

  async function assegnaGiocatore(giocatoreId: string) {
    if (!squadraGestitaId) return;
    const giocatore = svincolatiRicercabili.find((g) => g.id === giocatoreId);
    const prezzo = prezziAssegna[giocatoreId] ?? giocatore?.quotazione ?? 1;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/squadre/${squadraGestitaId}/rosa`, { method: "POST", body: { giocatoreId, prezzo } });
      showToast(`${giocatore?.nome ?? "Giocatore"} assegnato.`);
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nell'assegnazione", "error");
    } finally {
      setBusy(false);
    }
  }

  async function rimuoviGiocatore(squadraId: string, rosaId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/squadre/${squadraId}/rosa/${rosaId}`, { method: "DELETE" });
      showToast("Giocatore rimosso dalla rosa.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella rimozione", "error");
    } finally {
      setBusy(false);
    }
  }

  async function proponiScambio(e: FormEvent) {
    e.preventDefault();
    if (!id || !giocatoreOffertoId || !giocatoreRichiestoId || !squadraDestId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/scambi", {
        method: "POST",
        body: {
          legaId: id,
          squadraRiceventeId: squadraDestId,
          giocatoreOffertoId,
          giocatoreRichiestoId,
          differenzaCrediti,
        },
      });
      showToast("Proposta di scambio inviata!");
      setGiocatoreOffertoId("");
      setGiocatoreRichiestoId("");
      setDifferenzaCrediti(0);
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella proposta di scambio", "error");
    } finally {
      setBusy(false);
    }
  }

  async function rispondiScambio(scambioId: string, azione: "accetta" | "rifiuta") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/scambi/${scambioId}/${azione}`, { method: "POST" });
      showToast(azione === "accetta" ? "Scambio accettato!" : "Scambio rifiutato.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella risposta allo scambio", "error");
    } finally {
      setBusy(false);
    }
  }

  async function annullaScambio(scambioId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/scambi/${scambioId}`, { method: "DELETE" });
      showToast("Proposta annullata.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nell'annullamento", "error");
    } finally {
      setBusy(false);
    }
  }

  const rosaGestita = rose[squadraGestitaId] ?? [];
  const idAssegnatiLega = new Set(Object.values(rose).flatMap((r) => r.map((x) => x.giocatoreId)));
  const svincolatiRicercabili = svincolati.filter((g) => !idAssegnatiLega.has(g.id));
  const svincolatiFiltrati = svincolatiRicercabili.filter((g) => g.nome.toLowerCase().includes(qGestione.toLowerCase()));

  const rosaOfferente = miaSquadra ? rose[miaSquadra.id] ?? [] : [];
  const rosaDestinatario = rose[squadraDestId] ?? [];

  const scambiRicevuti = scambi.filter((s) => s.squadraRiceventeId === miaSquadra?.id && s.stato === "PENDING");
  const scambiInviati = scambi.filter((s) => s.squadraProponenteId === miaSquadra?.id);
  const scambiConclusi = scambi.filter((s) => s.stato !== "PENDING" && s.squadraProponenteId !== miaSquadra?.id && s.squadraRiceventeId !== miaSquadra?.id);

  function nomeSquadra(sid: string) {
    return squadre.find((s) => s.id === sid)?.nome ?? "?";
  }

  if (!lega) return null;

  return (
    <div>
      <h2>Mercato — {lega.nome}</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="card flex-between">
        <div>
          <p style={{ margin: 0 }}>
            Stato:{" "}
            {mercatoAttivo ? (
              <strong style={{ color: "var(--primary)" }}>
                Aperto{lega.mercatoChiusuraAt ? ` fino al ${new Date(lega.mercatoChiusuraAt).toLocaleDateString("it-IT")}` : ""}
              </strong>
            ) : (
              <strong className="muted">Chiuso</strong>
            )}
          </p>
          {!mercatoAttivo && (
            <p className="muted" style={{ marginTop: "0.25rem" }}>
              Quando il mercato e' chiuso solo l'admin puo' assegnare o togliere giocatori dalle rose; gli scambi tra
              partecipanti sono possibili solo a mercato aperto.
            </p>
          )}
        </div>
        {sonoAdmin && (
          <div>
            {mercatoAttivo ? (
              <button className="danger" disabled={busy} onClick={chiudiMercato}>
                Chiudi mercato
              </button>
            ) : (
              <form onSubmit={apriMercato} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={durataGiorni}
                  onChange={(e) => setDurataGiorni(Number(e.target.value))}
                  style={{ width: "70px" }}
                />
                <span className="muted">giorni</span>
                <button type="submit" disabled={busy}>
                  Apri mercato
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {sonoAdmin && mercatoAttivo && (
        <div className="card">
          <h3>Gestisci le rose (solo admin)</h3>
          <p className="muted" style={{ marginTop: "-0.5rem" }}>
            Assegna o rimuovi giocatori da qualsiasi squadra della lega mentre il mercato e' aperto.
          </p>
          <div className="form-row" style={{ maxWidth: "320px" }}>
            <label>Squadra da gestire</label>
            <select value={squadraGestitaId} onChange={(e) => setSquadraGestitaId(e.target.value)}>
              {squadre.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.utente?.nome ?? "-"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid cols-2">
            <div>
              <h4 className="muted" style={{ marginBottom: "0.5rem" }}>
                Rosa attuale ({rosaGestita.length})
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Ruolo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rosaGestita.map((r) => (
                    <tr key={r.id}>
                      <td>{r.giocatore.nome}</td>
                      <td>
                        <span className={`badge ruolo-${r.giocatore.ruolo}`}>{r.giocatore.ruolo}</span>
                      </td>
                      <td>
                        <button className="danger" disabled={busy} onClick={() => rimuoviGiocatore(squadraGestitaId, r.id)}>
                          Rimuovi
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rosaGestita.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Rosa vuota.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="muted" style={{ marginBottom: "0.5rem" }}>
                Svincolati
              </h4>
              <div className="form-row">
                <input placeholder="Cerca giocatore..." value={qGestione} onChange={(e) => setQGestione(e.target.value)} />
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Ruolo</th>
                    <th>Prezzo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {svincolatiFiltrati.slice(0, 40).map((g) => (
                    <tr key={g.id}>
                      <td>
                        {g.nome} <span className="muted">({g.squadraSerieA})</span>
                      </td>
                      <td>
                        <span className={`badge ruolo-${g.ruolo}`}>{g.ruolo}</span>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          style={{ width: "70px" }}
                          value={prezziAssegna[g.id] ?? g.quotazione ?? 1}
                          onChange={(e) => setPrezziAssegna({ ...prezziAssegna, [g.id]: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <button disabled={busy} onClick={() => assegnaGiocatore(g.id)}>
                          Assegna
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {miaSquadra && (
        <div className="card">
          <h3>Scambi tra partecipanti</h3>
          {!mercatoAttivo ? (
            <p className="muted">Gli scambi si possono proporre solo quando il mercato e' aperto.</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: "-0.5rem" }}>
                Offri un giocatore della tua rosa in cambio di uno di un'altra squadra. Puoi aggiungere un conguaglio
                in crediti a tuo favore (negativo) o a tuo carico (positivo).
              </p>
              <form onSubmit={proponiScambio}>
                <div className="grid cols-2">
                  <div className="form-row">
                    <label>Squadra con cui scambiare</label>
                    <select value={squadraDestId} onChange={(e) => { setSquadraDestId(e.target.value); setGiocatoreRichiestoId(""); }}>
                      {squadre
                        .filter((s) => s.id !== miaSquadra.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Conguaglio crediti (a tuo carico se positivo)</label>
                    <input type="number" value={differenzaCrediti} onChange={(e) => setDifferenzaCrediti(Number(e.target.value))} />
                  </div>
                  <div className="form-row">
                    <label>Il tuo giocatore da offrire</label>
                    <select required value={giocatoreOffertoId} onChange={(e) => setGiocatoreOffertoId(e.target.value)}>
                      <option value="">Seleziona...</option>
                      {rosaOfferente.map((r) => (
                        <option key={r.giocatoreId} value={r.giocatoreId}>
                          {r.giocatore.nome} ({r.giocatore.ruolo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Giocatore richiesto</label>
                    <select required value={giocatoreRichiestoId} onChange={(e) => setGiocatoreRichiestoId(e.target.value)}>
                      <option value="">Seleziona...</option>
                      {rosaDestinatario.map((r) => (
                        <option key={r.giocatoreId} value={r.giocatoreId}>
                          {r.giocatore.nome} ({r.giocatore.ruolo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={busy || !giocatoreOffertoId || !giocatoreRichiestoId}>
                  Proponi scambio
                </button>
              </form>
            </>
          )}

          {scambiRicevuti.length > 0 && (
            <>
              <h4 className="muted" style={{ marginTop: "1.5rem" }}>
                Proposte ricevute
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Da</th>
                    <th>Offre</th>
                    <th>In cambio di</th>
                    <th>Conguaglio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {scambiRicevuti.map((s) => (
                    <tr key={s.id}>
                      <td>{nomeSquadra(s.squadraProponenteId)}</td>
                      <td>{s.giocatoreOfferto.nome}</td>
                      <td>{s.giocatoreRichiesto.nome}</td>
                      <td>{s.differenzaCrediti}</td>
                      <td style={{ display: "flex", gap: "0.4rem" }}>
                        <button disabled={busy} onClick={() => rispondiScambio(s.id, "accetta")}>
                          Accetta
                        </button>
                        <button className="danger" disabled={busy} onClick={() => rispondiScambio(s.id, "rifiuta")}>
                          Rifiuta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {scambiInviati.length > 0 && (
            <>
              <h4 className="muted" style={{ marginTop: "1.5rem" }}>
                Le tue proposte
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>A</th>
                    <th>Offri</th>
                    <th>Richiedi</th>
                    <th>Stato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {scambiInviati.map((s) => (
                    <tr key={s.id}>
                      <td>{nomeSquadra(s.squadraRiceventeId)}</td>
                      <td>{s.giocatoreOfferto.nome}</td>
                      <td>{s.giocatoreRichiesto.nome}</td>
                      <td>{s.stato}</td>
                      <td>
                        {s.stato === "PENDING" && (
                          <button className="secondary" disabled={busy} onClick={() => annullaScambio(s.id)}>
                            Annulla
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {scambiConclusi.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary className="muted" style={{ cursor: "pointer" }}>
                Altri scambi nella lega ({scambiConclusi.length})
              </summary>
              <table style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr>
                    <th>Da</th>
                    <th>A</th>
                    <th>Scambio</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {scambiConclusi.map((s) => (
                    <tr key={s.id}>
                      <td>{nomeSquadra(s.squadraProponenteId)}</td>
                      <td>{nomeSquadra(s.squadraRiceventeId)}</td>
                      <td>
                        {s.giocatoreOfferto.nome} ⇄ {s.giocatoreRichiesto.nome}
                      </td>
                      <td>{s.stato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
