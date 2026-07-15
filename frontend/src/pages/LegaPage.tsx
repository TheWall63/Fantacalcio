import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Giornata, Lega, RigaClassifica } from "../api/types";
import { Skeleton, SkeletonTable } from "../components/Skeleton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function LegaPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [lega, setLega] = useState<Lega | null>(null);
  useDocumentTitle(lega ? lega.nome : "Lega");
  const [classifica, setClassifica] = useState<RigaClassifica[]>([]);
  const [giornate, setGiornate] = useState<Giornata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

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
    setMessaggio(null);
    try {
      await apiFetch("/giornate/calendario", { method: "POST", body: { legaId: id } });
      setMessaggio("Calendario generato con successo.");
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nella generazione del calendario");
    } finally {
      setBusy(false);
    }
  }

  async function sincronizzaGiornata() {
    if (!giornataCorrente) return;
    setBusy(true);
    setError(null);
    setMessaggio(null);
    try {
      const res = await apiFetch<{ demo: boolean; partiteAggiornate: number }>(`/giornate/${giornataCorrente.id}/sync`, { method: "POST" });
      setMessaggio(`Sincronizzati ${res.partiteAggiornate} incontri${res.demo ? " (dati demo)" : ""}.`);
      await ricarica();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nella sincronizzazione");
    } finally {
      setBusy(false);
    }
  }

  async function importaListone() {
    if (!csvFile) return;
    setBusy(true);
    setError(null);
    setMessaggio(null);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await apiFetch<{ creati: number; aggiornati: number }>("/giocatori/import", { method: "POST", formData });
      setMessaggio(`Import completato: ${res.creati} nuovi, ${res.aggiornati} aggiornati.`);
      setCsvFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore nell'import del listone");
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
      {messaggio && <div className="info-box">{messaggio}</div>}

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
                    <strong>{r.punti}</strong>
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
          <p className="muted">Solo l'admin della lega vede questi controlli.</p>

          <div className="grid cols-2">
            <div>
              <p>
                Calendario: <strong>{giornate.length > 0 ? `${giornate.length} giornate generate` : "non ancora generato"}</strong>
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

            <div>
              <p>Importa listone/immagini (CSV: nome,squadra,ruolo,quotazione,immagine — l'ultima colonna e' opzionale)</p>
              <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
              <button style={{ marginLeft: "0.5rem" }} disabled={busy || !csvFile} onClick={importaListone}>
                Importa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
