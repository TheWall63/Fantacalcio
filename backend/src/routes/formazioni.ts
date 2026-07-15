import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { MODULI_VALIDI, SCHEMA_MODULO } from "../types/domain";

const router = Router();
router.use(requireAuth);

const formazioneSchema = z.object({
  squadraId: z.string(),
  giornataId: z.string(),
  modulo: z.enum(MODULI_VALIDI),
  titolari: z.array(z.string()).length(11),
  panchina: z.array(z.string()).max(7).default([]),
});

// Schiera/aggiorna la formazione di una squadra per una giornata
router.put("/", async (req, res) => {
  const parsed = formazioneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { squadraId, giornataId, modulo, titolari, panchina } = parsed.data;

  const squadra = await prisma.squadra.findUnique({ where: { id: squadraId } });
  if (!squadra) return res.status(404).json({ error: "Squadra non trovata" });
  if (squadra.userId !== req.user!.userId) {
    return res.status(403).json({ error: "Non sei il proprietario di questa squadra" });
  }

  const idTutti = [...titolari, ...panchina];
  if (new Set(idTutti).size !== idTutti.length) {
    return res.status(400).json({ error: "Un giocatore non puo' comparire due volte in formazione" });
  }

  const rosa = await prisma.rosaGiocatore.findMany({
    where: { squadraId, giocatoreId: { in: idTutti } },
    include: { giocatore: true },
  });
  if (rosa.length !== idTutti.length) {
    return res.status(400).json({ error: "Uno o piu' giocatori non fanno parte della tua rosa" });
  }

  const ruoliTitolari = titolari.map((id) => rosa.find((r) => r.giocatoreId === id)!.giocatore.ruolo);
  const conteggio = { P: 0, D: 0, C: 0, A: 0 };
  for (const r of ruoliTitolari) conteggio[r as keyof typeof conteggio]++;

  const schema = SCHEMA_MODULO[modulo];
  if (conteggio.P !== 1 || conteggio.D !== schema.D || conteggio.C !== schema.C || conteggio.A !== schema.A) {
    return res.status(400).json({
      error: `La formazione non rispetta il modulo ${modulo} (richiesti: 1P ${schema.D}D ${schema.C}C ${schema.A}A)`,
    });
  }

  const formazione = await prisma.formazione.upsert({
    where: { squadraId_giornataId: { squadraId, giornataId } },
    create: { squadraId, giornataId, modulo },
    update: { modulo },
  });

  await prisma.formazioneGiocatore.deleteMany({ where: { formazioneId: formazione.id } });
  await prisma.formazioneGiocatore.createMany({
    data: [
      ...titolari.map((giocatoreId) => ({ formazioneId: formazione.id, giocatoreId, slot: "TITOLARE" as const, ordine: 0 })),
      ...panchina.map((giocatoreId, i) => ({ formazioneId: formazione.id, giocatoreId, slot: "PANCHINA" as const, ordine: i + 1 })),
    ],
  });

  const risultato = await prisma.formazione.findUnique({
    where: { id: formazione.id },
    include: { giocatori: { include: { giocatore: true } } },
  });
  res.json(risultato);
});

router.get("/:squadraId/:giornataId", async (req, res) => {
  const formazione = await prisma.formazione.findUnique({
    where: { squadraId_giornataId: { squadraId: req.params.squadraId, giornataId: req.params.giornataId } },
    include: { giocatori: { include: { giocatore: true } } },
  });
  if (!formazione) return res.status(404).json({ error: "Nessuna formazione schierata per questa giornata" });
  res.json(formazione);
});

export default router;
