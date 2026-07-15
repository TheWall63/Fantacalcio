import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { CartaBonus, Formazione, RosaGiocatore } from "../api/types";
import PlayerCard from "../components/PlayerCard";

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
  const [carte, setCarte] = useState<CartaBonus[]>([]);
  const [modulo, setModulo] = useState("3-4-3");
  const [titolari, setTitolari] = useState<Set<string>>(new Set());
  const [panchina, setPanchina] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!squadraId) return;
    apiFetch<RosaGiocatore[]>(`/squadre/${squadraId}/rosa`).then(setRosa);
    apiFetch<CartaBonus[]>(`/squadre/${squadraId}/carte`).then(setCarte).catch(() => {});
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

  const bonusAttivi = useMemo(() => new Set(carte.filter((c) => c.stato === "PENDING").map((c) => c.giocatoreId)), [carte]);

  const schema = SCHEMA[modulo];
  const conteggio = useMemo(() => {
    const c = { P: 0, D: 0, C: 0, A: 0 };
    for (const rid of titolari) {
      const r = rosa.find((x) => x.giocatoreId === rid);
      if (r) c[r.giocatore.ruolo]++;
    }
    return c;
  }, [titolari, rosa]);

  function ciclaStato(giocatoreId: string) {
    const inTitolari = titolari.has(giocatoreId);
    const inPanchina = panchina.has(giocatoreId);

    if (inTitolari) {
      const nextTitolari = new Set(titolari);
      nextTitolari.delete(giocatoreId);
      setTitolari(nextTitolari);
      if (panchina.size < 7) {
        setPanchina(new Set(panchina).add(giocatoreId));
      }
      return;
    }
    if (inPanchina) {
      const nextPanchina = new Set(panchina);
      nextPanchina.delete(giocatoreId);
      setPanchina(nextPanchina);
      return;
    }
    if (titolari.size < 11) {
      setTitolari(new Set(titolari).add(giocatoreId));
    } else if (panchina.size < 7) {
      setPanchina(new Set(panchina).add(giocatoreId));
    }
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

      {bonusAttivi.size > 0 && (
        <div className="info-box">
          Hai {bonusAttivi.size} carta/e bonus in attesa (badge dorato "+1"): se schieri quel giocatore da titolare
          questa giornata, riceve +1 al voto finale.
        </div>
      )}

      <div className="card">
        <h3>Rosa disponibile</h3>
        <p className="muted" style={{ marginTop: "-0.5rem" }}>
          Clicca un campioncino per schierarlo titolare, clicca di nuovo per mandarlo in panchina, un terzo click lo
          rimette libero.
        </p>
        <div className="player-card-grid">
          {rosa.map((r, i) => (
            <PlayerCard
              key={r.id}
              index={i}
              giocatore={r.giocatore}
              slot={titolari.has(r.giocatoreId) ? "TITOLARE" : panchina.has(r.giocatoreId) ? "PANCHINA" : null}
              hasBonus={bonusAttivi.has(r.giocatoreId)}
              onClick={() => ciclaStato(r.giocatoreId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
