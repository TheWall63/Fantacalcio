import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { generaCalendarioLega } from "../services/calendario";
import { sincronizzaGiornata } from "../services/scoring";

const router = Router();
router.use(requireAuth);

// Elenco giornate di una stagione (default quella corrente)
router.get("/", async (req, res) => {
  const stagione = (req.query.stagione as string) ?? "2025/26";
  const giornate = await prisma.giornata.findMany({ where: { stagione }, orderBy: { numero: "asc" } });
  res.json(giornate);
});

router.get("/:id", async (req, res) => {
  const giornata = await prisma.giornata.findUnique({
    where: { id: req.params.id },
    include: { partite: { include: { eventi: true } } },
  });
  if (!giornata) return res.status(404).json({ error: "Giornata non trovata" });
  res.json(giornata);
});

const calendarioSchema = z.object({ legaId: z.string() });

// Genera/rigenera il calendario a girone all'italiana per una lega
router.post("/calendario", async (req, res) => {
  const parsed = calendarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const lega = await prisma.lega.findUnique({ where: { id: parsed.data.legaId } });
  if (!lega) return res.status(404).json({ error: "Lega non trovata" });
  if (lega.adminId !== req.user!.userId) {
    return res.status(403).json({ error: "Solo l'admin della lega puo' generare il calendario" });
  }

  try {
    await generaCalendarioLega(parsed.data.legaId);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Sincronizza i dati live (reali o demo) di una giornata e ricalcola i punteggi
router.post("/:id/sync", async (req, res) => {
  try {
    const risultato = await sincronizzaGiornata(req.params.id);
    res.json(risultato);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
