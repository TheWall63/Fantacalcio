import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Giornata, Lega, RigaClassifica } from "../api/types";
import { Skeleton, SkeletonTable } from "../components/Skeleton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useCountUp } from "../hooks/useCountUp";
import { useToast } from "../context/ToastContext";

function PuntiClassifica({ valore }: { valore: number }) {
  const animato = useCountUp(valore);
  return <strong className="tabular">{Math.round(animato)}</strong>;
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

  async function sincronizzaGiornata() {
    if (!giornataCorrente) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ demo: boolean; partiteAggiornate: number }>(`/giornate/${giornataCorrente.id}/sync`, { method: "POST" });
      showToast(`Sincronizzati ${res.partiteAggiornate} incontri${res.demo ? " (dati demo)" : ""}.`);
      await ricarica();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Errore nella sincronizzazione", "error");
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
      <div className="flex-between">
        <h2>{lega.nome}</h2>
        <span className="muted">Codice invito: <strong>{lega.codiceInvito}</strong></span>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="grid cols-2">
        <div className="card">
          <h3>Classifica</h3>
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
              {classifica.map((r, i) => (
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

      {sonoAdmin && (
        <div className="card">
          <h3>Amministrazione lega</h3>
          <p className="muted">
            Solo l'admin della lega vede questi controlli. Il calendario si genera da solo appena la lega raggiunge 8
            squadre iscritte; da qui puoi comunque generarlo prima se siete di meno, o rigenerarlo.
          </p>
          <p>
            Calendario: <strong>{giornate.length > 0 ? `${giornate.length} giornate generate` : "non ancora generato"}</strong>
            {" "}&middot; Squadre iscritte: <strong>{lega.squadre?.length ?? 0}</strong>
          </p>
          <button className="secondary" disabled={busy} onClick={generaCalendario}>
            {giornate.length > 0 ? "Rigenera calendario" : "Genera calendario"}
          </button>
          {giornataCorrente && (
            <button style={{ marginLeft: "0.5rem" }} disabled={busy} onClick={sincronizzaGiornata}>
              Sincronizza giornata {giornataCorrente.numero}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
