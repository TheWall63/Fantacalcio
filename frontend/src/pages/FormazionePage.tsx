import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import type { CartaBonus, Formazione, Giornata, RosaGiocatore, Squadra } from "../api/types";
import PlayerCard from "../components/PlayerCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useToast } from "../context/ToastContext";

const TUTTI_MODULI = ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1"];
const SCHEMA: Record<string, { D: number; C: number; A: number }> = {
  "3-4-3": { D: 3, C: 4, A: 3 },
  "3-5-2": { D: 3, C: 5, A: 2 },
  "4-3-3": { D: 4, C: 3, A: 3 },
  "4-4-2": { D: 4, C: 4, A: 2 },
  "4-5-1": { D: 4, C: 5, A: 1 },
  "5-3-2": { D: 5, C: 3, A: 2 },
  "5-4-1": { D: 5, C: 4, A: 1 },
};
const ORE_ATTESA_MODIFICA_FORMAZIONE = 2;

export default function FormazionePage() {
  useDocumentTitle("Schiera formazione");
  const { squadraId, giornataId } = useParams<{ squadraId: string; giornataId: string }>();
  const { showToast } = useToast();
  const [squadra, setSquadra] = useState<Squadra | null>(null);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [rosa, setRosa] = useState<RosaGiocatore[]>([]);
  const [carte, setCarte] = useState<CartaBonus[]>([]);
  const [modulo, setModulo] = useState("");
  const [titolari, setTitolari] = useState<Set<string>>(new Set());
  const [panchina, setPanchina] = useState<Set<string>>(new Set());
  const [caricato, setCaricato] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MODULI = squadra?.lega?.moduliConsentiti && squadra.lega.moduliConsentiti.length > 0 ? squadra.lega.moduliConsentiti : TUTTI_MODULI;

  useEffect(() => {
    if (!squadraId || !giornataId) return;
    setCaricato(false);

    apiFetch<Squadra>(`/squadre/${squadraId}`).then(setSquadra);
    apiFetch<RosaGiocatore[]>(`/squadre/${squadraId}/rosa`).then(setRosa);
    apiFetch<CartaBonus[]>(`/squadre/${squadraId}/carte`).then(setCarte).catch(() => {});
    apiFetch<Giornata[]>(`/giornate?stagione=2025/26`).then(setGiornate).catch(() => {});

    apiFetch<Formazione>(`/formazioni/${squadraId}/${giornataId}`)
      .then((f) => {
        setModulo(f.modulo);
        setTitolari(new Set(f.giocatori.filter((g) => g.slot === "TITOLARE").map((g) => g.giocatoreId)));
        setPanchina(new Set(f.giocatori.filter((g) => g.slot === "PANCHINA").map((g) => g.giocatoreId)));
        setCaricato(true);
      })
      .catch(() => {
        // Nessuna formazione ancora salvata per questa giornata: proponiamo in
        // automatico l'ultima schierata (modulo e rosa titolare), cosi' le
        // scelte restano valide di giornata in giornata finche' non le cambi.
        apiFetch<Formazione>(`/formazioni/${squadraId}/precedente/${giornataId}`)
          .then((f) => {
            setModulo(f.modulo);
            setTitolari(new Set(f.giocatori.filter((g) => g.slot === "TITOLARE").map((g) => g.giocatoreId)));
            setPanchina(new Set(f.giocatori.filter((g) => g.slot === "PANCHINA").map((g) => g.giocatoreId)));
          })
          .catch(() => {
            setModulo("");
            setTitolari(new Set());
            setPanchina(new Set());
          })
          .finally(() => setCaricato(true));
      });
  }, [squadraId, giornataId]);

  const bonusAttivi = useMemo(() => {
    if (squadra?.lega && !squadra.lega.cartebonusAttive) return new Set<string>();
    return new Set(carte.filter((c) => c.stato === "PENDING").map((c) => c.giocatoreId));
  }, [carte, squadra]);

  const giornataTarget = giornate.find((g) => g.id === giornataId);
  const giornataPrecedente = giornataTarget ? giornate.find((g) => g.numero === giornataTarget.numero - 1) : undefined;

  const modificabile = useMemo(() => {
    if (!giornataTarget) return true; // non ancora caricata: non blocchiamo l'interfaccia mostrando errori prematuri
    if (giornataTarget.stato === "CONCLUSA") return false;
    if (giornataTarget.numero <= 1) return true;
    if (!giornataPrecedente?.dataFine) return false;
    const sbloccoAt = new Date(giornataPrecedente.dataFine).getTime() + ORE_ATTESA_MODIFICA_FORMAZIONE * 60 * 60 * 1000;
    return Date.now() >= sbloccoAt;
  }, [giornataTarget, giornataPrecedente]);

  const schema = SCHEMA[modulo] ?? { D: 0, C: 0, A: 0 };
  const conteggio = useMemo(() => {
    const c = { P: 0, D: 0, C: 0, A: 0 };
    for (const rid of titolari) {
      const r = rosa.find((x) => x.giocatoreId === rid);
      if (r) c[r.giocatore.ruolo]++;
    }
    return c;
  }, [titolari, rosa]);

  function ciclaStato(giocatoreId: string) {
    if (!modificabile || !modulo) return;
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
    try {
      await apiFetch("/formazioni", {
        method: "PUT",
        body: { squadraId, giornataId, modulo, titolari: Array.from(titolari), panchina: Array.from(panchina) },
      });
      showToast("Formazione salvata!");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nel salvataggio della formazione", "error");
    } finally {
      setBusy(false);
    }
  }

  const completo =
    modulo !== "" &&
    titolari.size === 11 &&
    conteggio.P === 1 &&
    conteggio.D === schema.D &&
    conteggio.C === schema.C &&
    conteggio.A === schema.A;

  return (
    <div>
      <h2>Schiera formazione{giornataTarget ? ` (giornata ${giornataTarget.numero})` : ""}</h2>
      {error && <div className="error-box">{error}</div>}

      {caricato && !modificabile && (
        <div className="info-box">
          {giornataTarget?.stato === "CONCLUSA"
            ? "Questa giornata è già conclusa: la formazione non è più modificabile."
            : "La formazione per questa giornata non è ancora modificabile: si sblocca un paio d'ore dopo che l'admin calcola i punteggi della giornata precedente."}
        </div>
      )}

      <div className="card flex-between">
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Modulo</label>
          <select value={modulo} disabled={!modificabile} onChange={(e) => setModulo(e.target.value)}>
            <option value="" disabled>
              -- Seleziona modulo --
            </option>
            {MODULI.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="muted">
            {modulo === "" ? (
              "Scegli un modulo per iniziare a schierare i titolari."
            ) : (
              <>
                Titolari: {titolari.size}/11 &middot; P {conteggio.P}/1, D {conteggio.D}/{schema.D}, C {conteggio.C}/{schema.C}, A{" "}
                {conteggio.A}/{schema.A}
              </>
            )}
          </p>
          <button disabled={!completo || !modificabile || busy} onClick={salva}>
            Salva formazione
          </button>
        </div>
      </div>

      {(squadra?.lega?.cartebonusAttive ?? true) && bonusAttivi.size > 0 && (
        <div className="info-box">
          Hai {bonusAttivi.size} carta/e bonus in attesa (badge dorato "+1"): se schieri quel giocatore da titolare
          questa giornata, riceve +1 al voto finale.
        </div>
      )}

      <div className="card">
        <h3>Rosa disponibile</h3>
        <p className="muted" style={{ marginTop: "-0.5rem" }}>
          {modulo === ""
            ? "Seleziona prima un modulo qui sopra: potrai schierare i titolari solo dopo."
            : "Clicca un campioncino per schierarlo titolare, clicca di nuovo per mandarlo in panchina, un terzo click lo rimette libero."}
        </p>
        <div className="player-card-grid">
          {rosa.map((r, i) => (
            <PlayerCard
              key={r.id}
              index={i}
              giocatore={r.giocatore}
              slot={titolari.has(r.giocatoreId) ? "TITOLARE" : panchina.has(r.giocatoreId) ? "PANCHINA" : null}
              hasBonus={bonusAttivi.has(r.giocatoreId)}
              disabled={!modificabile || modulo === ""}
              onClick={() => ciclaStato(r.giocatoreId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
