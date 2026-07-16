import { ORE_ATTESA_MODIFICA_FORMAZIONE } from "../types/domain";

interface GiornataMin {
  numero: number;
  stato: string;
  dataFine: Date | null;
}

// Le formazioni per la giornata N sono modificabili solo a partire da un paio
// d'ore dopo la fine (dataFine) della giornata N-1 (il tempo di calcolare i
// punteggi), e non sono piu' modificabili una volta che la giornata N stessa
// e' gia' conclusa.
export function puoModificareFormazione(target: GiornataMin, precedente: GiornataMin | null): boolean {
  if (target.stato === "CONCLUSA") return false;
  if (target.numero <= 1) return true;
  if (!precedente?.dataFine) return false;
  const sbloccoAt = precedente.dataFine.getTime() + ORE_ATTESA_MODIFICA_FORMAZIONE * 60 * 60 * 1000;
  return Date.now() >= sbloccoAt;
}
