import { prisma } from "../lib/prisma";

// Genera un calendario a girone all'italiana (round robin) per la lega:
// ogni squadra affronta tutte le altre, una giornata alla volta, fino a
// coprire lega.numeroGiornate (il calendario si ripete se le squadre sono
// poche rispetto al numero di giornate, come nel fantacalcio reale con andata/ritorno).
export async function generaCalendarioLega(legaId: string) {
  const lega = await prisma.lega.findUnique({ where: { id: legaId }, include: { squadre: true } });
  if (!lega) throw new Error("Lega non trovata");
  if (lega.squadre.length < 3) throw new Error("Servono almeno 3 squadre per generare il calendario");

  await prisma.scontro.deleteMany({ where: { legaId } });

  let squadre = lega.squadre.map((s) => s.id);
  const dispari = squadre.length % 2 !== 0;
  if (dispari) squadre = [...squadre, "__bye__"]; // turno di riposo se numero dispari

  const n = squadre.length;
  const turniPerGirone = n - 1;
  const rounds: [string, string][][] = [];

  let lista = [...squadre];
  for (let r = 0; r < turniPerGirone; r++) {
    const turno: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i];
      const b = lista[n - 1 - i];
      if (a !== "__bye__" && b !== "__bye__") {
        turno.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(turno);
    lista = [lista[0], ...lista.slice(2), lista[1]];
  }

  for (let numero = 1; numero <= lega.numeroGiornate; numero++) {
    const giornata = await prisma.giornata.upsert({
      where: { numero_stagione: { numero, stagione: lega.stagione } },
      create: { numero, stagione: lega.stagione },
      update: {},
    });

    const roundIndex = (numero - 1) % rounds.length;
    const invertito = Math.floor((numero - 1) / rounds.length) % 2 === 1; // ritorno = casa/trasferta invertiti
    const turno = rounds[roundIndex];

    for (const [x, y] of turno) {
      const [casa, trasf] = invertito ? [y, x] : [x, y];
      await prisma.scontro.upsert({
        where: { giornataId_squadraCasaId_squadraTrasfId: { giornataId: giornata.id, squadraCasaId: casa, squadraTrasfId: trasf } },
        create: { legaId, giornataId: giornata.id, squadraCasaId: casa, squadraTrasfId: trasf },
        update: {},
      });
    }
  }
}
