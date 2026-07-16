import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { RUOLI } from "../types/domain";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Lista giocatori con filtri di ricerca (nome, ruolo, squadra reale)
router.get("/", requireAuth, async (req, res) => {
  const { q, ruolo, squadra } = req.query as { q?: string; ruolo?: string; squadra?: string };

  const giocatori = await prisma.giocatore.findMany({
    where: {
      attivo: true,
      ...(q ? { nome: { contains: q } } : {}),
      ...(ruolo ? { ruolo } : {}),
      ...(squadra ? { squadraSerieA: squadra } : {}),
    },
    orderBy: [{ ruolo: "asc" }, { nome: "asc" }],
  });

  res.json(giocatori);
});

router.get("/squadre", requireAuth, async (_req, res) => {
  const squadre = await prisma.giocatore.findMany({
    where: { attivo: true },
    select: { squadraSerieA: true },
    distinct: ["squadraSerieA"],
    orderBy: { squadraSerieA: "asc" },
  });
  res.json(squadre.map((s) => s.squadraSerieA));
});

router.get("/:id", requireAuth, async (req, res) => {
  const giocatore = await prisma.giocatore.findUnique({
    where: { id: req.params.id },
    include: { punteggi: { orderBy: { giornata: { numero: "desc" } }, take: 10, include: { giornata: true } } },
  });
  if (!giocatore) return res.status(404).json({ error: "Giocatore non trovato" });
  res.json(giocatore);
});

// Statistiche stagionali del giocatore (gol, assist, rigori, presenze) e
// cronologia partita per partita con lo stato di presenza, usata per il
// pannello di dettaglio che si apre cliccando sul nome del giocatore.
router.get("/:id/statistiche", requireAuth, async (req, res) => {
  const giocatore = await prisma.giocatore.findUnique({ where: { id: req.params.id } });
  if (!giocatore) return res.status(404).json({ error: "Giocatore non trovato" });

  const [punteggi, eventi, partiteTotali] = await Promise.all([
    prisma.punteggioGiocatore.findMany({
      where: { giocatoreId: giocatore.id },
      include: { giornata: true },
      orderBy: { giornata: { numero: "asc" } },
    }),
    prisma.eventoPartita.findMany({ where: { giocatoreId: giocatore.id }, select: { tipo: true } }),
    // Giornate per cui esiste gia' almeno un punteggio calcolato: le
    // "partite totali giocate in generale" finora in questa stagione.
    prisma.giornata.count({ where: { punteggi: { some: {} } } }),
  ]);

  const conta = (tipo: string) => eventi.filter((e) => e.tipo === tipo).length;
  const partiteGiocate = punteggi.filter((p) => p.presenza === "TITOLARE" || p.presenza === "SUBENTRATO").length;

  res.json({
    giocatore,
    statistiche: {
      partiteTotali,
      partiteGiocate,
      gol: conta("GOL"),
      assist: conta("ASSIST"),
      rigoriSegnati: conta("RIGORE_SEGNATO"),
      rigoriSbagliati: conta("RIGORE_SBAGLIATO"),
    },
    cronologia: punteggi.map((p) => ({
      giornataId: p.giornataId,
      numero: p.giornata.numero,
      presenza: p.presenza,
      punti: p.punti,
    })),
  });
});

// Import CSV del "listone" ufficiale (nome,squadra,ruolo,quotazione,immagine)
// La colonna "immagine" e' opzionale: URL (https://...) o path statico servito
// dal frontend (es. /players/lautaro-martinez.jpg messo in frontend/public/players/).
// Chiunque sia autenticato puo' importare: in una lega tra amici non serve
// un ruolo admin dedicato, ma l'operazione e' idempotente (upsert per nome+squadra).
router.post("/import", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File CSV mancante (campo 'file')" });

  let righe: Record<string, string>[];
  try {
    righe = parse(req.file.buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return res.status(400).json({ error: "CSV non valido: " + (e as Error).message });
  }

  let creati = 0;
  let aggiornati = 0;
  const errori: string[] = [];

  for (const [i, riga] of righe.entries()) {
    const nome = riga.nome?.trim();
    const squadraSerieA = riga.squadra?.trim();
    const ruolo = riga.ruolo?.trim().toUpperCase();
    const quotazioneRaw = riga.quotazione?.trim();
    const immagineUrl = riga.immagine?.trim() || undefined;

    if (!nome || !squadraSerieA || !ruolo) {
      errori.push(`Riga ${i + 2}: nome/squadra/ruolo mancanti`);
      continue;
    }
    if (!RUOLI.includes(ruolo as (typeof RUOLI)[number])) {
      errori.push(`Riga ${i + 2}: ruolo "${ruolo}" non valido (atteso P/D/C/A)`);
      continue;
    }
    const quotazione = quotazioneRaw ? parseInt(quotazioneRaw, 10) : undefined;

    const esistente = await prisma.giocatore.findFirst({ where: { nome, squadraSerieA } });
    if (esistente) {
      await prisma.giocatore.update({
        where: { id: esistente.id },
        data: {
          ruolo,
          ...(quotazione !== undefined && !Number.isNaN(quotazione) ? { quotazione } : {}),
          ...(immagineUrl ? { immagineUrl } : {}),
        },
      });
      aggiornati++;
    } else {
      await prisma.giocatore.create({
        data: {
          nome,
          squadraSerieA,
          ruolo,
          quotazione: quotazione && !Number.isNaN(quotazione) ? quotazione : null,
          immagineUrl: immagineUrl ?? null,
        },
      });
      creati++;
    }
  }

  res.json({ creati, aggiornati, righeTotali: righe.length, errori: errori.slice(0, 20) });
});

const immagineSchema = z.object({ immagineUrl: z.string().url().nullable() });

// Imposta/rimuove l'immagine del "campioncino" di un singolo giocatore
router.patch("/:id/immagine", requireAuth, async (req, res) => {
  const parsed = immagineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "URL immagine non valido" });

  const giocatore = await prisma.giocatore.findUnique({ where: { id: req.params.id } });
  if (!giocatore) return res.status(404).json({ error: "Giocatore non trovato" });

  const aggiornato = await prisma.giocatore.update({
    where: { id: req.params.id },
    data: { immagineUrl: parsed.data.immagineUrl },
  });
  res.json(aggiornato);
});

export default router;
