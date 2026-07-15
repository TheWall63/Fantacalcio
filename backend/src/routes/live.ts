import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isLiveDataConfigured } from "../services/footballData";

const router = Router();
router.use(requireAuth);

// Stato live: partite in corso/recenti con relativi eventi, per la giornata corrente
router.get("/", async (req, res) => {
  const stagione = (req.query.stagione as string) ?? "2025/26";
  const giornataCorrente = await prisma.giornata.findFirst({
    where: { stagione, stato: { in: ["IN_CORSO", "PROGRAMMATA"] } },
    orderBy: { numero: "asc" },
  });

  const partite = giornataCorrente
    ? await prisma.partita.findMany({
        where: { giornataId: giornataCorrente.id },
        include: { eventi: true },
        orderBy: { dataOra: "asc" },
      })
    : [];

  res.json({
    demo: !isLiveDataConfigured(),
    giornata: giornataCorrente,
    partite,
  });
});

export default router;
