export const RUOLI = ["P", "D", "C", "A"] as const;
export type Ruolo = (typeof RUOLI)[number];

export const MODULI_VALIDI = [
  "3-4-3",
  "3-5-2",
  "4-3-3",
  "4-4-2",
  "4-5-1",
  "5-3-2",
  "5-4-1",
] as const;
export type Modulo = (typeof MODULI_VALIDI)[number];

// Numero di titolari per ruolo richiesti da ciascun modulo (P sempre 1)
export const SCHEMA_MODULO: Record<Modulo, { D: number; C: number; A: number }> = {
  "3-4-3": { D: 3, C: 4, A: 3 },
  "3-5-2": { D: 3, C: 5, A: 2 },
  "4-3-3": { D: 4, C: 3, A: 3 },
  "4-4-2": { D: 4, C: 4, A: 2 },
  "4-5-1": { D: 4, C: 5, A: 1 },
  "5-3-2": { D: 5, C: 3, A: 2 },
  "5-4-1": { D: 5, C: 4, A: 1 },
};

// Numero minimo di squadre iscritte oltre il quale il calendario della lega
// viene generato automaticamente (vedi routes/leghe.ts, join).
export const MIN_SQUADRE_CALENDARIO_AUTO = 8;

// Durata massima in giorni per cui il "Mercato" di una lega puo' restare aperto.
export const MERCATO_DURATA_MAX_GIORNI = 30;

// Modificatore difesa (stile Leghe FC): bonus/malus alla formazione in base
// alla media voto dei titolari portiere+difensori schierati in giornata.
export const SOGLIE_MODIFICATORE_DIFESA: { minMedia: number; bonus: number }[] = [
  { minMedia: 7, bonus: 3 },
  { minMedia: 6.5, bonus: 2 },
  { minMedia: 6, bonus: 1 },
  { minMedia: 5.5, bonus: 0 },
  { minMedia: -Infinity, bonus: -1 },
];

export const STATO_PARTITA = ["SCHEDULED", "LIVE", "FINISHED"] as const;
export const STATO_GIORNATA = ["PROGRAMMATA", "IN_CORSO", "CONCLUSA"] as const;
export const SLOT_FORMAZIONE = ["TITOLARE", "PANCHINA"] as const;

export const TIPO_EVENTO = [
  "GOL",
  "AUTOGOL",
  "ASSIST",
  "AMMONIZIONE",
  "ESPULSIONE",
  "RIGORE_SEGNATO",
  "RIGORE_SBAGLIATO",
  "RIGORE_PARATO",
] as const;
export type TipoEvento = (typeof TIPO_EVENTO)[number];

// Bonus/malus applicati al voto base (6) per calcolare il fantavoto.
// Regole classiche del fantacalcio "ad eventi" (non sono i voti ufficiali
// dei giornalisti, che sono dati proprietari a pagamento): qui il punteggio
// e' derivato dagli eventi reali della partita (gol, assist, cartellini...).
export const BONUS_MALUS: Record<TipoEvento, number> = {
  GOL: 3,
  AUTOGOL: -2,
  ASSIST: 1,
  AMMONIZIONE: -0.5,
  ESPULSIONE: -1,
  RIGORE_SEGNATO: 3,
  RIGORE_SBAGLIATO: -3,
  RIGORE_PARATO: 3,
};
