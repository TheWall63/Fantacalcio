import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { Giocatore, Giornata, RosaGiocatore } from "../api/types";

export default function SquadraPage() {
  const { id } = useParams<{ id: string }>();
  const [rosa, setRosa] = useState<RosaGiocatore[]>([]);
  const [svincolati, setSvincolati] = useState<Giocatore[]>([]);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [prezzi, setPrezzi] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const ricarica = useCallback(async () => {
    if (!id) return;
    try {
      const [r, s, g] = await Promise.all([
        apiFetch<RosaGiocatore[]>(`/squadre/${id}/rosa`),
        apiFetch<Giocatore[]>(`/squadre/${id}/svincolati`),
        apiFetch<Giornata[]>(`/giornate?stagione=2025/26`),
      ]);
      setRosa(r);
      setSvincolati(s);
      setGiornate(g);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento della squadra");
    }
  }, [id]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  const budgetSpeso = rosa.reduce((acc, r) => acc + r.prezzoPagato, 0);
  const svincolatiFiltrati = svincolati.filter((g) => g.nome.toLowerCase().includes(q.toLowerCase()));
  const giornataCorrente = giornate.find((g) => g.stato !== "CONCLUSA") ?? giornate[0];

  async function acquista(giocatoreId: string) {
    if (!id) return;
    const suggerito = svincolati.find((g) => g.id === giocatoreId)?.quotazione ?? 1;
    const prezzo = prezzi[giocatoreId] ?? suggerito;
    setBusy(true);
    setError(null);
    setMessaggio(null);
    try {
      await apiFetch(`/squadre/${id}/rosa`, { method: "POST", body: { giocatoreId, prezzo } });
      setMessaggio("Giocatore acquistato.");
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nell'acquisto");
    } finally {
      setBusy(false);
    }
  }

  async function svincola(rosaId: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    setMessaggio(null);
    try {
      await apiFetch(`/squadre/${id}/rosa/${rosaId}`, { method: "DELETE" });
      setMessaggio("Giocatore svincolato.");
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nello svincolo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>La mia squadra</h2>
      {error && <div className="error-box">{error}</div>}
      {messaggio && <div className="info-box">{messaggio}</div>}

      <div className="card flex-between">
        <div>
          <p className="muted">Budget speso: {budgetSpeso}</p>
          <p className="muted">Giocatori in rosa: {rosa.length}</p>
        </div>
        {giornataCorrente && (
          <Link to={`/formazione/${id}/${giornataCorrente.id}`}>
            <button>Schiera formazione (giornata {giornataCorrente.numero})</button>
          </Link>
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
