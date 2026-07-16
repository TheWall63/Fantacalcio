import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import type { Giocatore, Partita } from "../api/types";
import { SkeletonTable } from "../components/Skeleton";
import GiocatoreStatsModal from "../components/GiocatoreStatsModal";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

interface LiveResponse {
  demo: boolean;
  giornata: { id: string; numero: number; stato: string } | null;
  partite: Partita[];
}

const RUOLI_LABEL: Record<string, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };

export default function GiocatoriPage() {
  useDocumentTitle("Giocatori & Live");
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [squadre, setSquadre] = useState<string[]>([]);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [q, setQ] = useState("");
  const [ruolo, setRuolo] = useState("");
  const [squadra, setSquadra] = useState("");
  const [loading, setLoading] = useState(true);
  const [giocatoreSelezionato, setGiocatoreSelezionato] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<string[]>("/giocatori/squadre").then(setSquadre).catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch<LiveResponse>("/live").then(setLive).catch(() => {});
    const interval = setInterval(() => {
      apiFetch<LiveResponse>("/live").then(setLive).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (ruolo) params.set("ruolo", ruolo);
    if (squadra) params.set("squadra", squadra);
    const timeout = setTimeout(() => {
      apiFetch<Giocatore[]>(`/giocatori?${params.toString()}`)
        .then(setGiocatori)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q, ruolo, squadra]);

  return (
    <div>
      <h2>Giocatori Serie A</h2>

      {live && live.partite.length > 0 && (
        <div className="card">
          <div className="flex-between">
            <h3>
              Live {live.giornata && `- Giornata ${live.giornata.numero}`}
            </h3>
            {live.demo && <span className="badge demo">DEMO</span>}
          </div>
          {live.demo && (
            <div className="info-box">
              Nessuna API key configurata: questi sono risultati simulati a scopo dimostrativo. Configura
              FOOTBALL_DATA_API_KEY nel backend per dati reali (vedi README).
            </div>
          )}
          {live.partite.map((p) => (
            <div className="match-card" key={p.id}>
              <div className="match-teams">
                <span>{p.squadraCasa}</span>
                <span>{p.squadraTrasf}</span>
              </div>
              <div className="match-score">
                {p.golCasa ?? "-"} : {p.golTrasf ?? "-"}
              </div>
              <span className={`badge ${p.stato === "LIVE" ? "live" : p.stato === "FINISHED" ? "finished" : ""}`}>
                {p.stato === "LIVE" ? "LIVE" : p.stato === "FINISHED" ? "Finita" : "Da giocare"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="grid cols-3">
          <div className="form-row">
            <label>Cerca giocatore</label>
            <input placeholder="es. Lautaro" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Ruolo</label>
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
              <option value="">Tutti</option>
              {Object.entries(RUOLI_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Squadra</label>
            <select value={squadra} onChange={(e) => setSquadra(e.target.value)}>
              <option value="">Tutte</option>
              {squadre.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <SkeletonTable rows={8} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ruolo</th>
                <th>Squadra</th>
                <th>Quotazione</th>
              </tr>
            </thead>
            <tbody>
              {giocatori.map((g) => (
                <tr key={g.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => setGiocatoreSelezionato(g.id)}>
                      {g.nome}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ruolo-${g.ruolo}`}>{g.ruolo}</span>
                  </td>
                  <td>{g.squadraSerieA}</td>
                  <td>{g.quotazione ?? <span className="muted">n/d</span>}</td>
                </tr>
              ))}
              {giocatori.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nessun giocatore trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {giocatoreSelezionato && (
        <GiocatoreStatsModal giocatoreId={giocatoreSelezionato} onClose={() => setGiocatoreSelezionato(null)} />
      )}
    </div>
  );
}
