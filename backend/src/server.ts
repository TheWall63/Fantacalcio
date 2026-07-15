import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import legheRoutes from "./routes/leghe";
import squadreRoutes from "./routes/squadre";
import giocatoriRoutes from "./routes/giocatori";
import giornateRoutes from "./routes/giornate";
import formazioniRoutes from "./routes/formazioni";
import liveRoutes from "./routes/live";
import { avviaCronLive } from "./services/cronJob";
import { isLiveDataConfigured } from "./services/footballData";
import { prisma } from "./lib/prisma";
import { seedGiocatori } from "./seed/seed";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, liveDataConfigurata: isLiveDataConfigured() });
});

app.use("/api/auth", authRoutes);
app.use("/api/leghe", legheRoutes);
app.use("/api/squadre", squadreRoutes);
app.use("/api/giocatori", giocatoriRoutes);
app.use("/api/giornate", giornateRoutes);
app.use("/api/formazioni", formazioniRoutes);
app.use("/api/live", liveRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Errore interno del server" });
});

const port = Number(process.env.PORT ?? 4000);

async function avvia() {
  // Seed automatico al primo avvio su un database vuoto (es. subito dopo il
  // deploy su un hosting nuovo): evita di dover aprire una shell remota per
  // lanciare `npm run seed` a mano.
  try {
    const totaleGiocatori = await prisma.giocatore.count();
    if (totaleGiocatori === 0) {
      console.log("Nessun giocatore nel database: eseguo il seed iniziale...");
      const { creati, saltati } = await seedGiocatori();
      console.log(`Seed automatico completato: ${creati} giocatori importati, ${saltati} righe saltate.`);
    }
  } catch (err) {
    console.error("Seed automatico fallito (il server parte comunque):", (err as Error).message);
  }

  app.listen(port, () => {
    console.log(`Fantacalcio API in ascolto su http://localhost:${port}`);
    console.log(`Dati live: ${isLiveDataConfigured() ? "API reale configurata" : "modalita' DEMO (nessuna API key)"}`);
    avviaCronLive();
  });
}

avvia();
