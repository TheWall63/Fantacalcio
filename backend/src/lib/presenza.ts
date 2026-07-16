import { StatoPresenza } from "../types/domain";

// Hash deterministico (FNV-1a) su giocatoreId+giornataId, normalizzato in
// [0,1): usato per scegliere uno stato di presenza in modo stabile, cosi'
// ri-sincronizzare la stessa giornata piu' volte non fa "sfarfallare" i
// colori dello storico partite.
function seedDeterministico(a: string, b: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${a}|${b}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

// Determina la presenza di un giocatore in una giornata. Se ha eventi
// registrati (gol/assist/cartellino/rigore) sappiamo per certo che ha
// giocato: solo il dubbio titolare/subentrato resta stimato. Se non ha
// eventi, in modalita' reale (football-data free) non abbiamo modo di
// saperlo con certezza (niente distinte ufficiali sul piano gratuito), quindi
// restiamo onesti e lo segnamo NON_CONVOCATO; in modalita' DEMO simuliamo
// tutti e quattro gli stati per rendere la funzionalita' dimostrabile.
export function determinaPresenza(giocatoreId: string, giornataId: string, haEventi: boolean, demo: boolean): StatoPresenza {
  const seed = seedDeterministico(giocatoreId, giornataId);

  if (haEventi) {
    return seed < 0.8 ? "TITOLARE" : "SUBENTRATO";
  }
  if (!demo) return "NON_CONVOCATO";

  if (seed < 0.4) return "TITOLARE";
  if (seed < 0.55) return "SUBENTRATO";
  if (seed < 0.9) return "NON_CONVOCATO";
  return "INFORTUNATO";
}
