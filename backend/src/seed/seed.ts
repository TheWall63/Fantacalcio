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
async function main() {
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

  console.log(`Seed completato: ${creati} giocatori importati, ${saltati} righe saltate.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
