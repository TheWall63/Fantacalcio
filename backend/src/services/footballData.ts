// Client per l'API gratuita football-data.org (piano free, competizione Serie A = "SA")
// Documentazione: https://www.football-data.org/documentation/quickstart
// Il piano gratuito include Serie A ma con limite di 10 richieste/minuto e dati
// meno dettagliati (marcatori/cartellini non sempre presenti). Il codice qui
// sotto e' scritto per degradare in modo elegante quando mancano i dettagli.

const BASE_URL = "https://api.football-data.org/v4";

export class FootballDataError extends Error {}

function getApiKey(): string | null {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function isLiveDataConfigured(): boolean {
  return getApiKey() !== null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function apiGet(path: string): Promise<any> {
  const key = getApiKey();
  if (!key) throw new FootballDataError("FOOTBALL_DATA_API_KEY non configurata: modalita' demo attiva");

  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": key },
  });

  if (resp.status === 429) {
    throw new FootballDataError("Limite di richieste API superato (piano free: 10/min). Riprova tra poco.");
  }
  if (!resp.ok) {
    throw new FootballDataError(`Errore API football-data.org: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export interface PartitaEsterna {
  externalId: number;
  squadraCasa: string;
  squadraTrasf: string;
  golCasa: number | null;
  golTrasf: number | null;
  stato: "SCHEDULED" | "LIVE" | "FINISHED";
  dataOra: string;
  eventi: EventoEsterno[];
}

export interface EventoEsterno {
  tipo: "GOL" | "AUTOGOL" | "ASSIST" | "AMMONIZIONE" | "ESPULSIONE" | "RIGORE_SEGNATO";
  minuto: number | null;
  giocatoreNome: string | null;
  squadra: string;
}

const STATO_MAP: Record<string, "SCHEDULED" | "LIVE" | "FINISHED"> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "SCHEDULED",
  IN_PLAY: "LIVE",
  PAUSED: "LIVE",
  FINISHED: "FINISHED",
  SUSPENDED: "SCHEDULED",
  POSTPONED: "SCHEDULED",
  CANCELLED: "SCHEDULED",
};

export async function fetchGiornataSerieA(matchday: number): Promise<PartitaEsterna[]> {
  const data = await apiGet(`/competitions/SA/matches?matchday=${matchday}`);
  return (data.matches ?? []).map(mappaPartita);
}

export async function fetchPartiteLive(): Promise<PartitaEsterna[]> {
  const data = await apiGet(`/competitions/SA/matches?status=LIVE`);
  return (data.matches ?? []).map(mappaPartita);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mappaPartita(m: any): PartitaEsterna {
  const eventi: EventoEsterno[] = [];

  // Il piano free spesso non espone i marcatori dettagliati: quando presenti
  // (goals[]) li usiamo, altrimenti l'evento resta assente e il punteggio
  // fantacalcio si baser? solo sul risultato/pulita rete (vedi services/scoring.ts).
  for (const gol of m.goals ?? []) {
    eventi.push({
      tipo: gol.type === "OWN" ? "AUTOGOL" : "GOL",
      minuto: gol.minute ?? null,
      giocatoreNome: gol.scorer?.name ?? null,
      squadra: gol.team?.name ?? "",
    });
    if (gol.assist?.name) {
      eventi.push({
        tipo: "ASSIST",
        minuto: gol.minute ?? null,
        giocatoreNome: gol.assist.name,
        squadra: gol.team?.name ?? "",
      });
    }
  }
  for (const carta of m.bookings ?? []) {
    eventi.push({
      tipo: carta.card === "RED" ? "ESPULSIONE" : "AMMONIZIONE",
      minuto: carta.minute ?? null,
      giocatoreNome: carta.player?.name ?? null,
      squadra: carta.team?.name ?? "",
    });
  }

  return {
    externalId: m.id,
    squadraCasa: m.homeTeam?.name ?? "",
    squadraTrasf: m.awayTeam?.name ?? "",
    golCasa: m.score?.fullTime?.home ?? null,
    golTrasf: m.score?.fullTime?.away ?? null,
    stato: STATO_MAP[m.status] ?? "SCHEDULED",
    dataOra: m.utcDate,
    eventi,
  };
}
