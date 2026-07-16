import { prisma } from "../lib/prisma";
import { SQUADRE_SERIE_A } from "../config/squadreSerieA";
import { PartitaEsterna, EventoEsterno } from "./footballData";

// Genera un turno di partite "finte" quando non e' configurata una API key,
// cosi' l'app e' comunque dimostrabile end-to-end senza costi. Chiaramente
// etichettato come DEMO lato frontend (vedi flag `demo: true` nella response).
// Oltre al risultato, genera anche marcatori/assist/rigori/ammoniti pescando
// dai giocatori reali delle due squadre, cosi' anche le statistiche
// individuali (gol, assist, storico presenze) hanno qualcosa da mostrare.
export async function generaGiornataDemo(numero: number): Promise<PartitaEsterna[]> {
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

    const eventi: EventoEsterno[] = [
      ...(await eventiSquadra(casa.nome, golCasa)),
      ...(await eventiSquadra(trasf.nome, golTrasf)),
    ];

    partite.push({
      externalId: -(numero * 1000 + i), // id negativo per non confliggere con id reali dell'API
      squadraCasa: casa.nome,
      squadraTrasf: trasf.nome,
      golCasa,
      golTrasf,
      stato: "LIVE",
      dataOra: new Date().toISOString(),
      eventi,
    });
  }

  return partite;
}

function scegli<T>(lista: T[]): T | undefined {
  if (lista.length === 0) return undefined;
  return lista[Math.floor(Math.random() * lista.length)];
}

async function eventiSquadra(squadraSerieA: string, gol: number): Promise<EventoEsterno[]> {
  const rosa = await prisma.giocatore.findMany({ where: { squadraSerieA, attivo: true } });
  if (rosa.length === 0) return [];

  const potenzialiMarcatori = rosa.filter((g) => g.ruolo === "A" || g.ruolo === "C");
  const marcatori = potenzialiMarcatori.length > 0 ? potenzialiMarcatori : rosa;
  const eventi: EventoEsterno[] = [];

  for (let i = 0; i < gol; i++) {
    const marcatore = scegli(marcatori);
    if (!marcatore) continue;
    const suRigore = Math.random() < 0.12;
    eventi.push({
      tipo: suRigore ? "RIGORE_SEGNATO" : "GOL",
      minuto: 1 + Math.floor(Math.random() * 89),
      giocatoreNome: marcatore.nome,
      squadra: squadraSerieA,
    });
    if (!suRigore && Math.random() < 0.6) {
      const assistman = scegli(rosa.filter((g) => g.id !== marcatore.id));
      if (assistman) {
        eventi.push({ tipo: "ASSIST", minuto: null, giocatoreNome: assistman.nome, squadra: squadraSerieA });
      }
    }
  }

  // Qualche rigore sbagliato, a prescindere dal risultato finale
  if (Math.random() < 0.12) {
    const rigorista = scegli(marcatori);
    if (rigorista) {
      eventi.push({
        tipo: "RIGORE_SBAGLIATO",
        minuto: 1 + Math.floor(Math.random() * 89),
        giocatoreNome: rigorista.nome,
        squadra: squadraSerieA,
      });
    }
  }

  // Cartellini: 0-2 ammoniti a squadra, rara espulsione
  const numAmmoniti = Math.random() < 0.75 ? (Math.random() < 0.35 ? 2 : 1) : 0;
  for (let i = 0; i < numAmmoniti; i++) {
    const ammonito = scegli(rosa);
    if (ammonito) {
      eventi.push({ tipo: "AMMONIZIONE", minuto: 1 + Math.floor(Math.random() * 89), giocatoreNome: ammonito.nome, squadra: squadraSerieA });
    }
  }
  if (Math.random() < 0.05) {
    const espulso = scegli(rosa);
    if (espulso) {
      eventi.push({ tipo: "ESPULSIONE", minuto: 1 + Math.floor(Math.random() * 89), giocatoreNome: espulso.nome, squadra: squadraSerieA });
    }
  }

  return eventi;
}
