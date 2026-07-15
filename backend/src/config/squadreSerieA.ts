// Le 20 squadre di Serie A 2025/26 con alias usati per riconoscere il nome
// squadra restituito da football-data.org (che spesso usa la denominazione
// ufficiale societaria, es. "FC Internazionale Milano" invece di "Inter").
// Se un alias non combacia piu' (cambi di sponsor/denominazione), aggiorna
// qui: e' l'unico punto da toccare per il matching squadre.
export interface SquadraSerieA {
  nome: string; // nome breve usato nel nostro DB (Giocatore.squadraSerieA)
  alias: string[];
}

export const SQUADRE_SERIE_A: SquadraSerieA[] = [
  { nome: "Atalanta", alias: ["Atalanta"] },
  { nome: "Bologna", alias: ["Bologna"] },
  { nome: "Cagliari", alias: ["Cagliari"] },
  { nome: "Como", alias: ["Como"] },
  { nome: "Cremonese", alias: ["Cremonese"] },
  { nome: "Fiorentina", alias: ["Fiorentina"] },
  { nome: "Genoa", alias: ["Genoa"] },
  { nome: "Inter", alias: ["Inter", "Internazionale"] },
  { nome: "Juventus", alias: ["Juventus"] },
  { nome: "Lazio", alias: ["Lazio"] },
  { nome: "Lecce", alias: ["Lecce"] },
  { nome: "Milan", alias: ["AC Milan", "Milan"] },
  { nome: "Napoli", alias: ["Napoli"] },
  { nome: "Parma", alias: ["Parma"] },
  { nome: "Pisa", alias: ["Pisa"] },
  { nome: "Roma", alias: ["Roma"] },
  { nome: "Sassuolo", alias: ["Sassuolo"] },
  { nome: "Torino", alias: ["Torino"] },
  { nome: "Udinese", alias: ["Udinese"] },
  { nome: "Verona", alias: ["Verona", "Hellas Verona"] },
];

export function trovaSquadraDaNomeEsterno(nomeEsterno: string): string | null {
  const target = nomeEsterno.toLowerCase();
  for (const s of SQUADRE_SERIE_A) {
    if (s.alias.some((a) => target.includes(a.toLowerCase()))) return s.nome;
  }
  return null;
}
