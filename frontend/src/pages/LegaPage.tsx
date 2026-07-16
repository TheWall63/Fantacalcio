import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Giornata, Lega, RigaClassifica, RigaClassificaPunti, RigaClassificaScontri } from "../api/types";
import { Skeleton, SkeletonTable } from "../components/Skeleton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useCountUp } from "../hooks/useCountUp";
import { useToast } from "../context/ToastContext";

const ORE_ATTESA_MODIFICA_FORMAZIONE = 2;

function PuntiClassifica({ valore }: { valore: number }) {
  const animato = useCountUp(valore);
  return <strong className="tabular">{Math.round(animato)}</strong>;
}

function isRigaScontri(r: RigaClassifica): r is RigaClassificaScontri {
  return "vinte" in r;
}
function isRigaPunti(r: RigaClassifica): r is RigaClassificaPunti {
  return "puntiTotali" in r;
}

export default function LegaPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [lega, setLega] = useState<Lega | null>(null);
  useDocumentTitle(lega ? lega.nome : "Lega");
  const [classifica, setClassifica] = useState<RigaClassifica[]>([]);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ricarica = useCallback(async () => {
    if (!id) return;
    try {
      const [l, c, g] = await Promise.all([
        apiFetch<Lega>(`/leghe/${id}`),
        apiFetch<RigaClassifica[]>(`/leghe/${id}/classifica`),
        apiFetch<Giornata[]>(`/giornate?stagione=2025/26`),
      ]);
      setLega(l);
      setClassifica(c);
      setGiornate(g);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nel caricamento della lega");
    }
  }, [id]);

  useEffect(() => {
    ricarica();
  }, [ricarica]);

  const miaSquadra = lega?.squadre?.find((s) => s.userId === user?.id);
  const sonoAdmin = lega?.adminId === user?.id;
  const giornataCorrente = giornate.find((g) => g.stato !== "CONCLUSA") ?? giornate[0];
  const giornataPrecedente = giornataCorrente ? giornate.find((g) => g.numero === giornataCorrente.numero - 1) : undefined;

  const formazioneModificabile = (() => {
    if (!giornataCorrente) return false;
    if (giornataCorrente.numero <= 1) return true;
    if (!giornataPrecedente?.dataFine) return false;
    const sbloccoAt = new Date(giornataPrecedente.dataFine).getTime() + ORE_ATTESA_MODIFICA_FORMAZIONE * 60 * 60 * 1000;
    return Date.now() >= sbloccoAt;
  })();

  async function generaCalendario() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/giornate/calendario", { method: "POST", body: { legaId: id } });
      showToast("Calendario generato con successo.");
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella generazione del calendario", "error");
    } finally {
      setBusy(false);
    }
  }

  async function calcolaPunteggi() {
    if (!giornataCorrente) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ demo: boolean; partiteAggiornate: number }>(`/giornate/${giornataCorrente.id}/concludi`, {
        method: "POST",
      });
      showToast(
        `Punteggi calcolati per tutti i partecipanti (giornata ${giornataCorrente.numero}, ${res.partiteAggiornate} incontri${
          res.demo ? " demo" : ""
        }).`
      );
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nel calcolo dei punteggi", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!lega) {
    return (
      <div>
        <Skeleton width="40%" height="1.6rem" className="skeleton-line" />
        <div className="grid cols-2" style={{ marginTop: "1rem" }}>
          <div className="card">
            <SkeletonTable rows={4} />
          </div>
          <div className="card">
            <SkeletonTable rows={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between" style={{ alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{lega.nome}</h2>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Codice invito: <strong>{lega.codiceInvito}</strong>
          </span>
        </div>
        <Link to={`/leghe/${lega.id}/mercato`}>
          <button className="secondary btn-sm">Mercato{lega.mercatoAperto ? " (aperto)" : ""}</button>
        </Link>
      </div>
      {error && <div className="error-box">{error}</div>}

      {sonoAdmin && !lega.impostazioniCompletate && (
        <div className="info-box flex-between">
          <span>Non hai ancora completato la configurazione di questa lega (moduli, modificatore difesa, bonus mvp, carte bonus).</span>
          <Link to={`/leghe/${lega.id}/setup`}>
            <button style={{ whiteSpace: "nowrap" }}>Configura ora</button>
          </Link>
        </div>
      )}

      <div className="grid cols-2">
        <div className="card">
          <h3>Classifica</h3>
          {lega.modalitaClassifica === "PUNTI" ? (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Squadra</th>
                  <th>Punti totali</th>
                  <th>Giornate</th>
                </tr>
              </thead>
              <tbody>
                {classifica.filter(isRigaPunti).map((r, i) => (
                  <tr key={r.squadraId}>
                    <td>
                      <span className={`rank-pos ${i < 3 ? `rank-${i + 1}` : ""}`}>{i + 1}</span>
                    </td>
                    <td>{r.squadra.nome}</td>
                    <td>
                      <PuntiClassifica valore={r.puntiTotali} />
                    </td>
                    <td>{r.giornateDisputate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Squadra</th>
                  <th>Pt</th>
                  <th>V</th>
                  <th>N</th>
                  <th>P</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {classifica.filter(isRigaScontri).map((r, i) => (
                  <tr key={r.squadraId}>
                    <td>
                      <span className={`rank-pos ${i < 3 ? `rank-${i + 1}` : ""}`}>{i + 1}</span>
                    </td>
                    <td>{r.squadra.nome}</td>
                    <td>
                      <PuntiClassifica valore={r.punti} />
                    </td>
                    <td>{r.vinte}</td>
                    <td>{r.pareggiate}</td>
                    <td>{r.perse}</td>
                    <td>{r.differenza.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Squadre iscritte</h3>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Allenatore</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {lega.squadre?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/squadre/${s.id}`}>{s.nome}</Link>
                  </td>
                  <td>{s.utente?.nome ?? "-"}</td>
                  <td>{s.budgetResiduo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {miaSquadra && (
            <Link to={`/squadre/${miaSquadra.id}`}>
              <button style={{ marginTop: "0.75rem" }}>Gestisci la mia squadra</button>
            </Link>
          )}
        </div>
      </div>

      {miaSquadra && (
        <div className="card">
          <h3>Formazione</h3>
          {giornataCorrente ? (
            <>
              <p className="muted" style={{ marginTop: "-0.5rem" }}>
                Le scelte restano valide di giornata in giornata finché non le cambi tu stesso; puoi modificarle a
                partire da un paio d'ore dopo che l'admin ha calcolato i punteggi della giornata precedente.
              </p>
              {!formazioneModificabile && (
                <div className="info-box">
                  La formazione per la giornata {giornataCorrente.numero} non è ancora modificabile: si sblocca un
                  paio d'ore dopo che l'admin calcola i punteggi della giornata {giornataCorrente.numero - 1}.
                </div>
              )}
              <Link to={`/formazione/${miaSquadra.id}/${giornataCorrente.id}`}>
                <button>Schiera formazione (giornata {giornataCorrente.numero})</button>
              </Link>
            </>
          ) : (
            <p className="muted">Il calendario non è stato ancora generato per questa lega.</p>
          )}
        </div>
      )}

      {sonoAdmin && (
        <div className="card">
          <h3>Amministrazione lega</h3>
          <p className="muted">
            Solo l'admin della lega vede questi controlli. Il calendario si genera da solo appena la lega raggiunge 8
            squadre iscritte; da qui puoi comunque generarlo prima (servono almeno 3 squadre), o rigenerarlo.
          </p>
          <p>
            Calendario: <strong>{giornate.length > 0 ? `${giornate.length} giornate generate` : "non ancora generato"}</strong>
            {" "}&middot; Squadre iscritte: <strong>{lega.squadre?.length ?? 0}</strong>
          </p>
          <button className="secondary" disabled={busy} onClick={generaCalendario}>
            {giornate.length > 0 ? "Rigenera calendario" : "Genera calendario"}
          </button>
          {giornataCorrente && (
            <button style={{ marginLeft: "0.5rem" }} disabled={busy} onClick={calcolaPunteggi}>
              Calcola punteggi (giornata {giornataCorrente.numero})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
