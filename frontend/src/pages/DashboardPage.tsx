import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { Lega } from "../api/types";
import { Skeleton } from "../components/Skeleton";

export default function DashboardPage() {
  const [leghe, setLeghe] = useState<Lega[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nomeLega, setNomeLega] = useState("");
  const [nomeSquadra, setNomeSquadra] = useState("");
  const [budget, setBudget] = useState(500);
  const [codiceInvito, setCodiceInvito] = useState("");
  const [nomeSquadraJoin, setNomeSquadraJoin] = useState("");
  const [busy, setBusy] = useState(false);

  async function ricarica() {
    setLoading(true);
    try {
      const data = await apiFetch<Lega[]>("/leghe");
      setLeghe(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento delle leghe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ricarica();
  }, []);

  async function creaLega(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/leghe", { method: "POST", body: { nome: nomeLega, nomeSquadra, budgetIniziale: budget } });
      setNomeLega("");
      setNomeSquadra("");
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nella creazione della lega");
    } finally {
      setBusy(false);
    }
  }

  async function entraLega(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/leghe/join", { method: "POST", body: { codiceInvito: codiceInvito.toUpperCase(), nomeSquadra: nomeSquadraJoin } });
      setCodiceInvito("");
      setNomeSquadraJoin("");
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nell'iscrizione alla lega");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Le mie leghe</h2>
      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="grid cols-2">
          <div className="card">
            <Skeleton width="55%" height="1.2rem" className="skeleton-line" />
            <Skeleton width="80%" />
          </div>
          <div className="card">
            <Skeleton width="55%" height="1.2rem" className="skeleton-line" />
            <Skeleton width="80%" />
          </div>
        </div>
      ) : leghe.length === 0 ? (
        <p className="muted">Non fai ancora parte di nessuna lega. Creane una o entra con un codice invito.</p>
      ) : (
        <div className="grid cols-2">
          {leghe.map((l, i) => (
            <div key={l.id} className="card" style={{ animationDelay: `${i * 60}ms` }}>
              <h3>{l.nome}</h3>
              <p className="muted">
                Stagione {l.stagione} &middot; Budget {l.budgetIniziale} &middot; Codice invito: <strong>{l.codiceInvito}</strong>
              </p>
              <Link to={`/leghe/${l.id}`}>
                <button>Apri lega</button>
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-2" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <h3>Crea una nuova lega</h3>
          <form onSubmit={creaLega}>
            <div className="form-row">
              <label>Nome lega</label>
              <input required value={nomeLega} onChange={(e) => setNomeLega(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Nome della tua squadra</label>
              <input required value={nomeSquadra} onChange={(e) => setNomeSquadra(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Budget iniziale per squadra</label>
              <input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
            <button type="submit" disabled={busy}>
              Crea lega
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Entra in una lega esistente</h3>
          <form onSubmit={entraLega}>
            <div className="form-row">
              <label>Codice invito</label>
              <input required value={codiceInvito} onChange={(e) => setCodiceInvito(e.target.value)} style={{ textTransform: "uppercase" }} />
            </div>
            <div className="form-row">
              <label>Nome della tua squadra</label>
              <input required value={nomeSquadraJoin} onChange={(e) => setNomeSquadraJoin(e.target.value)} />
            </div>
            <button type="submit" disabled={busy}>
              Entra nella lega
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
