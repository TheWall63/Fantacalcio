import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { sincronizzaGiornata } from "./scoring";

// Ogni 3 minuti prova ad aggiornare la giornata corrente (se esiste).
// Rispetta il rate limit del piano free di football-data.org (10 richieste/min):
// una sync per giornata usa 1 sola chiamata API a fetchGiornataSerieA.
export function avviaCronLive() {
  cron.schedule("*/3 * * * *", async () => {
    try {
      const giornata = await prisma.giornata.findFirst({
        where: { stato: { in: ["IN_CORSO", "PROGRAMMATA"] } },
        orderBy: { numero: "asc" },
      });
      if (!giornata) return;
      await sincronizzaGiornata(giornata.id);
    } catch (err) {
      console.error("[cron] sync live fallita:", (err as Error).message);
    }
  });
}
