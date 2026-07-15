import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { Formazione, RosaGiocatore } from "../api/types";

const MODULI = ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1"];
const SCHEMA: Record<string, { D: number; C: number; A: number }> = {
  "3-4-3": { D: 3, C: 4, A: 3 },
  "3-5-2": { D: 3, C: 5, A: 2 },
  "4-3-3": { D: 4, C: 3, A: 3 },
  "4-4-2": { D: 4, C: 4, A: 2 },
  "4-5-1": { D: 4, C: 5, A: 1 },
  "5-3-2": { D: 5, C: 3, A: 2 },
  "5-4-1": { D: 5, C: 4, A: 1 },
};

export default function FormazionePage() {
  const { squadraId, giornataId } = useParams<{ squadraId: string; giornataId: string }>();
  const [rosa, setRosa] = useState<RosaGiocatore[]>([]);
  const [modulo, setModulo] = useState("3-4-3");
  const [titolari, setTitolari] = useState<Set<string>>(new Set());
  const [panchina, setPanchina] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!squadraId) return;
    apiFetch<RosaGiocatore[]>(`/squadre/${squadraId}/rosa`).then(setRosa);
    if (giornataId) {
      apiFetch<Formazione>(`/formazioni/${squadraId}/${giornataId}`)
        .then((f) => {
          setModulo(f.modulo);
          setTitolari(new Set(f.giocatori.filter((g) => g.slot === "TITOLARE").map((g) => g.giocatoreId)));
          setPanchina(new Set(f.giocatori.filter((g) => g.slot === "PANCHINA").map((g) => g.giocatoreId)));
        })
        .catch(() => {});
    }
  }, [squadraId, giornataId]);

  const schema = SCHEMA[modulo];
  const conteggio = useMemo(() => {
    const c = { P: 0, D: 0, C: 0, A: 0 };
    for (const rid of titolari) {
      const r = rosa.find((x) => x.giocatoreId === rid);
      if (r) c[r.giocatore.ruolo]++;
    }
    return c;
  }, [titolari, rosa]);

  function toggleTitolare(giocatoreId: string) {
    const next = new Set(titolari);
    if (next.has(giocatoreId)) {
      next.delete(giocatoreId);
    } else {
      next.add(giocatoreId);
      const nextPanchina = new Set(panchina);
      nextPanchina.delete(giocatoreId);
      setPanchina(nextPanchina);
    }
    setTitolari(next);
  }

  function togglePanchina(giocatoreId: string) {
    const next = new Set(panchina);
    if (next.has(giocatoreId)) {
      next.delete(giocatoreId);
    } else {
      next.add(giocatoreId);
      const nextTitolari = new Set(titolari);
      nextTitolari.delete(giocatoreId);
      setTitolari(nextTitolari);
    }
    setPanchina(next);
  }

  async function salva() {
    if (!squadraId || !giornataId) return;
    setBusy(true);
    setError(null);
    setMessaggio(null);
    try {
      await apiFetch("/formazioni", {
        method: "PUT",
        body: { squadraId, giornataId, modulo, titolari: Array.from(titolari), panchina: Array.from(panchina) },
      });
      setMessaggio("Formazione salvata!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel salvataggio della formazione");
    } finally {
      setBusy(false);
    }
  }

  const completo = titolari.size === 11 && conteggio.P === 1 && conteggio.D === schema.D && conteggio.C === schema.C && conteggio.A === schema.A;

  return (
    <div>
      <h2>Schiera formazione</h2>
      {error && <div className="error-box">{error}</div>}
      {messaggio && <div className="info-box">{messaggio}</div>}

      <div className="card flex-between">
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Modulo</label>
          <select value={modulo} onChange={(e) => setModulo(e.target.value)}>
            {MODULI.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="muted">
            Titolari: {titolari.size}/11 &middot; P {conteggio.P}/1, D {conteggio.D}/{schema.D}, C {conteggio.C}/{schema.C}, A {conteggio.A}/
            {schema.A}
          </p>
          <button disabled={!completo || busy} onClick={salva}>
            Salva formazione
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Rosa disponibile</h3>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Squadra</th>
              <th>Titolare</th>
              <th>Panchina</th>
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
                <td>
                  <input type="checkbox" checked={titolari.has(r.giocatoreId)} onChange={() => toggleTitolare(r.giocatoreId)} />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={panchina.has(r.giocatoreId)}
                    disabled={panchina.size >= 7 && !panchina.has(r.giocatoreId)}
                    onChange={() => togglePanchina(r.giocatoreId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
