export type Ruolo = "P" | "D" | "C" | "A";

export interface User {
  id: string;
  email: string;
  nome: string;
}

export interface Lega {
  id: string;
  nome: string;
  codiceInvito: string;
  stagione: string;
  budgetIniziale: number;
  numeroGiornate: number;
  adminId: string;
  createdAt: string;
  miaSquadraId?: string;
  squadre?: Squadra[];
}

export interface Squadra {
  id: string;
  nome: string;
  legaId: string;
  userId: string;
  budgetResiduo: number;
  createdAt: string;
  utente?: User;
}

export interface Giocatore {
  id: string;
  nome: string;
  squadraSerieA: string;
  ruolo: Ruolo;
  quotazione: number | null;
  immagineUrl: string | null;
  attivo: boolean;
}

export interface RosaGiocatore {
  id: string;
  squadraId: string;
  giocatoreId: string;
  prezzoPagato: number;
  giocatore: Giocatore;
}

export interface Giornata {
  id: string;
  numero: number;
  stagione: string;
  stato: "PROGRAMMATA" | "IN_CORSO" | "CONCLUSA";
}

export interface EventoPartita {
  id: string;
  tipo: string;
  minuto: number | null;
  squadra: string;
  giocatoreId: string | null;
}

export interface Partita {
  id: string;
  squadraCasa: string;
  squadraTrasf: string;
  golCasa: number | null;
  golTrasf: number | null;
  stato: "SCHEDULED" | "LIVE" | "FINISHED";
  dataOra: string | null;
  eventi: EventoPartita[];
}

export interface RigaClassifica {
  squadraId: string;
  punti: number;
  vinte: number;
  pareggiate: number;
  perse: number;
  fatti: number;
  subiti: number;
  differenza: number;
  squadra: Squadra;
}

export interface Formazione {
  id: string;
  squadraId: string;
  giornataId: string;
  modulo: string;
  punteggio: number | null;
  giocatori: { giocatoreId: string; slot: "TITOLARE" | "PANCHINA"; giocatore: Giocatore }[];
}

export interface CartaBonus {
  id: string;
  squadraId: string;
  giocatoreId: string;
  giornataAperturaId: string;
  stato: "PENDING" | "USATA";
  giornataUtilizzoId: string | null;
  createdAt: string;
  giocatore: Giocatore;
  giornataApertura?: Giornata;
  giornataUtilizzo?: Giornata | null;
}
