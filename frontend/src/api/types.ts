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
  moduliConsentiti: string[];
  modificatoreDifesa: boolean;
  bonusMvp: boolean;
  cartebonusAttive: boolean;
  modalitaClassifica: "SCONTRI_DIRETTI" | "PUNTI";
  impostazioniCompletate: boolean;
  mercatoAperto: boolean;
  mercatoChiusuraAt: string | null;
}

export interface Squadra {
  id: string;
  nome: string;
  legaId: string;
  userId: string;
  budgetResiduo: number;
  createdAt: string;
  utente?: User;
  lega?: Lega;
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
  dataInizio: string | null;
  dataFine: string | null;
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

// Formato in caso di lega a scontri diretti (girone all'italiana, punti-partita)
export interface RigaClassificaScontri {
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

// Formato in caso di lega a "modalita' punti" (somma fantapunti in stagione, stile Leghe FC)
export interface RigaClassificaPunti {
  squadraId: string;
  puntiTotali: number;
  giornateDisputate: number;
  squadra: Squadra;
}

export type RigaClassifica = RigaClassificaScontri | RigaClassificaPunti;

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

export type StatoPresenza = "TITOLARE" | "SUBENTRATO" | "NON_CONVOCATO" | "INFORTUNATO";

export interface StatisticheGiocatore {
  giocatore: Giocatore;
  statistiche: {
    partiteTotali: number;
    partiteGiocate: number;
    gol: number;
    assist: number;
    rigoriSegnati: number;
    rigoriSbagliati: number;
  };
  cronologia: { giornataId: string; numero: number; presenza: StatoPresenza; punti: number }[];
}

export interface RichiestaScambio {
  id: string;
  legaId: string;
  squadraProponenteId: string;
  squadraRiceventeId: string;
  giocatoreOffertoId: string;
  giocatoreRichiestoId: string;
  differenzaCrediti: number;
  stato: "PENDING" | "ACCETTATA" | "RIFIUTATA" | "ANNULLATA";
  createdAt: string;
  aggiornatoAt: string;
  squadraProponente: Squadra;
  squadraRicevente: Squadra;
  giocatoreOfferto: Giocatore;
  giocatoreRichiesto: Giocatore;
}
