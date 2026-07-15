import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { RUOLI } from "../types/domain";

// Seed dei giocatori Serie A 2025/26 da fonte pubblica (rose/ruoli), con
// quotazioni APPROSSIMATIVE generate come base di partenza per l'asta (non
// sono il listone ufficiale, che resta importabile via /api/giocatori/import
// per non redistribuire dati proprietari di terzi). Vedi README per i dettagli.
//
// Esportata come funzione (anziche' solo script CLI) cosi' server.ts puo'
// eseguirla automaticamente al primo avvio se il DB e' vuoto: utile su
// hosting come Render dove non c'e' un modo comodo di lanciare `npm run seed`
// a mano dopo il deploy.
export async function seedGiocatori(): Promise<{ creati: number; saltati: number }> {
  const csvPath = join(__dirname, "seriea_players_2025_26.csv");
  const righe: Record<string, string>[] = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const visti = new Set<string>();
  let creati = 0;
  let saltati = 0;

  for (const riga of righe) {
    const nome = riga.nome?.trim();
    const squadraSerieA = riga.squadra?.trim();
    const ruolo = riga.ruolo?.trim().toUpperCase();
    const quotazioneRaw = riga.quotazione?.trim();
    const quotazione = quotazioneRaw ? parseInt(quotazioneRaw, 10) : null;
    if (!nome || !squadraSerieA || !ruolo || !RUOLI.includes(ruolo as (typeof RUOLI)[number])) {
      saltati++;
      continue;
    }
    // Dedup per nome: evita ambiguita' quando lo stesso nome compare per
    // errore in due rose diverse nella raccolta dati.
    if (visti.has(nome)) {
      saltati++;
      continue;
    }
    visti.add(nome);

    const esistente = await prisma.giocatore.findFirst({ where: { nome } });
    if (esistente) {
      // Non sovrascriviamo una quotazione gia' presente (es. da un listone
      // ufficiale importato in seguito): aggiorniamo solo squadra/ruolo.
      await prisma.giocatore.update({ where: { id: esistente.id }, data: { squadraSerieA, ruolo } });
    } else {
      await prisma.giocatore.create({ data: { nome, squadraSerieA, ruolo, quotazione } });
    }
    creati++;
  }

  return { creati, saltati };
}

// Entry point CLI: `npm run seed`. Non parte quando il file viene importato
// da server.ts per l'auto-seed.
if (require.main === module) {
  seedGiocatori()
    .then(({ creati, saltati }) => {
      console.log(`Seed completato: ${creati} giocatori importati, ${saltati} righe saltate.`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
