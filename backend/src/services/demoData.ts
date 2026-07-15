import { SQUADRE_SERIE_A } from "../config/squadreSerieA";
import { PartitaEsterna } from "./footballData";

// Genera un turno di partite "finte" quando non e' configurata una API key,
// cosi' l'app e' comunque dimostrabile end-to-end senza costi. Chiaramente
// etichettato come DEMO lato frontend (vedi flag `demo: true` nella response).
export function generaGiornataDemo(numero: number): PartitaEsterna[] {
  const squadre = [...SQUADRE_SERIE_A];
  const partite: PartitaEsterna[] = [];

  // Mischia deterministicamente in base al numero di giornata per avere
  // accoppiamenti diversi turno per turno, senza dipendere da Math.random
  // per la formazione delle coppie (i punteggi restano casuali).
  const ordinati = [...squadre].sort((a, b) => {
    const ia = (a.nome.charCodeAt(0) + numero) % 20;
    const ib = (b.nome.charCodeAt(0) + numero) % 20;
    return ia - ib;
  });

  for (let i = 0; i < ordinati.length; i += 2) {
    const casa = ordinati[i];
    const trasf = ordinati[i + 1];
    if (!casa || !trasf) continue;

    const golCasa = Math.floor(Math.random() * 4);
    const golTrasf = Math.floor(Math.random() * 4);

    partite.push({
      externalId: -(numero * 1000 + i), // id negativo per non confliggere con id reali dell'API
      squadraCasa: casa.nome,
      squadraTrasf: trasf.nome,
      golCasa,
      golTrasf,
      stato: "LIVE",
      dataOra: new Date().toISOString(),
      eventi: [],
    });
  }

  return partite;
}
