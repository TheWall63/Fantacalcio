import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

async function mercatoAperto(legaId: string) {
  const lega = await prisma.lega.findUnique({ where: { id: legaId } });
  if (!lega) return { ok: false as const, error: "Lega non trovata", status: 404 };
  if (!lega.mercatoAperto || (lega.mercatoChiusuraAt && lega.mercatoChiusuraAt < new Date())) {
    return { ok: false as const, error: "Il mercato di questa lega non e' aperto", status: 403 };
  }
  return { ok: true as const, lega };
}

const creaSchema = z.object({
  legaId: z.string(),
  squadraRiceventeId: z.string(),
  giocatoreOffertoId: z.string(),
  giocatoreRichiestoId: z.string(),
  differenzaCrediti: z.number().int().default(0),
});

// Propone uno scambio: la squadra proponente offre un suo giocatore in cambio
// di uno della squadra ricevente, con un eventuale conguaglio in crediti.
router.post("/", async (req, res) => {
  const userId = req.user!.userId;
  const parsed = creaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { legaId, squadraRiceventeId, giocatoreOffertoId, giocatoreRichiestoId, differenzaCrediti } = parsed.data;

  const check = await mercatoAperto(legaId);
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const proponente = await prisma.squadra.findFirst({ where: { legaId, userId } });
  if (!proponente) return res.status(403).json({ error: "Non hai una squadra in questa lega" });
  if (proponente.id === squadraRiceventeId) {
    return res.status(400).json({ error: "Non puoi proporre uno scambio con la tua stessa squadra" });
  }

  const ricevente = await prisma.squadra.findUnique({ where: { id: squadraRiceventeId } });
  if (!ricevente || ricevente.legaId !== legaId) {
    return res.status(404).json({ error: "Squadra ricevente non trovata in questa lega" });
  }

  const [possiedeOfferto, possiedeRichiesto] = await Promise.all([
    prisma.rosaGiocatore.findUnique({ where: { squadraId_giocatoreId: { squadraId: proponente.id, giocatoreId: giocatoreOffertoId } } }),
    prisma.rosaGiocatore.findUnique({ where: { squadraId_giocatoreId: { squadraId: ricevente.id, giocatoreId: giocatoreRichiestoId } } }),
  ]);
  if (!possiedeOfferto) return res.status(400).json({ error: "Il giocatore offerto non e' nella tua rosa" });
  if (!possiedeRichiesto) return res.status(400).json({ error: "Il giocatore richiesto non e' nella rosa della squadra ricevente" });

  const scambio = await prisma.richiestaScambio.create({
    data: {
      legaId,
      squadraProponenteId: proponente.id,
      squadraRiceventeId: ricevente.id,
      giocatoreOffertoId,
      giocatoreRichiestoId,
      differenzaCrediti,
    },
    include: {
      squadraProponente: true,
      squadraRicevente: true,
      giocatoreOfferto: true,
      giocatoreRichiesto: true,
    },
  });
  res.status(201).json(scambio);
});

// Elenco degli scambi (inviati e ricevuti) della lega per l'utente autenticato
router.get("/", async (req, res) => {
  const userId = req.user!.userId;
  const legaId = req.query.legaId as string | undefined;
  if (!legaId) return res.status(400).json({ error: "Parametro legaId mancante" });

  const miaSquadra = await prisma.squadra.findFirst({ where: { legaId, userId } });
  if (!miaSquadra) return res.status(403).json({ error: "Non fai parte di questa lega" });

  const scambi = await prisma.richiestaScambio.findMany({
    where: { legaId, OR: [{ squadraProponenteId: miaSquadra.id }, { squadraRiceventeId: miaSquadra.id }] },
    include: {
      squadraProponente: true,
      squadraRicevente: true,
      giocatoreOfferto: true,
      giocatoreRichiesto: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(scambi);
});

async function trovaScambioPendingConSquadra(id: string, squadraId: string, ruolo: "squadraProponenteId" | "squadraRiceventeId") {
  const scambio = await prisma.richiestaScambio.findUnique({ where: { id } });
  if (!scambio) return { ok: false as const, error: "Scambio non trovato", status: 404 };
  if (scambio[ruolo] !== squadraId) return { ok: false as const, error: "Non sei autorizzato su questo scambio", status: 403 };
  if (scambio.stato !== "PENDING") return { ok: false as const, error: "Questo scambio non e' piu' in attesa", status: 409 };
  return { ok: true as const, scambio };
}

// Accetta uno scambio: la squadra ricevente conferma e i due giocatori (con
// l'eventuale conguaglio in crediti) cambiano proprietario in una transazione.
router.post("/:id/accetta", async (req, res) => {
  const userId = req.user!.userId;
  const scambioBase = await prisma.richiestaScambio.findUnique({ where: { id: req.params.id } });
  if (!scambioBase) return res.status(404).json({ error: "Scambio non trovato" });

  const ricevente = await prisma.squadra.findUnique({ where: { id: scambioBase.squadraRiceventeId } });
  if (!ricevente || ricevente.userId !== userId) {
    return res.status(403).json({ error: "Solo la squadra ricevente puo' accettare questo scambio" });
  }

  const check = await trovaScambioPendingConSquadra(req.params.id, ricevente.id, "squadraRiceventeId");
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  const scambio = check.scambio;

  const mercato = await mercatoAperto(scambio.legaId);
  if (!mercato.ok) return res.status(mercato.status).json({ error: mercato.error });

  const [rosaOfferto, rosaRichiesto] = await Promise.all([
    prisma.rosaGiocatore.findUnique({
      where: { squadraId_giocatoreId: { squadraId: scambio.squadraProponenteId, giocatoreId: scambio.giocatoreOffertoId } },
    }),
    prisma.rosaGiocatore.findUnique({
      where: { squadraId_giocatoreId: { squadraId: scambio.squadraRiceventeId, giocatoreId: scambio.giocatoreRichiestoId } },
    }),
  ]);
  if (!rosaOfferto || !rosaRichiesto) {
    return res.status(409).json({ error: "Uno dei giocatori coinvolti non e' piu' disponibile per lo scambio" });
  }

  await prisma.$transaction([
    prisma.rosaGiocatore.update({ where: { id: rosaOfferto.id }, data: { squadraId: scambio.squadraRiceventeId } }),
    prisma.rosaGiocatore.update({ where: { id: rosaRichiesto.id }, data: { squadraId: scambio.squadraProponenteId } }),
    prisma.squadra.update({ where: { id: scambio.squadraProponenteId }, data: { budgetResiduo: { decrement: scambio.differenzaCrediti } } }),
    prisma.squadra.update({ where: { id: scambio.squadraRiceventeId }, data: { budgetResiduo: { increment: scambio.differenzaCrediti } } }),
    prisma.richiestaScambio.update({ where: { id: scambio.id }, data: { stato: "ACCETTATA" } }),
    // Le altre proposte pendenti su uno dei due giocatori non sono piu' valide
    prisma.richiestaScambio.updateMany({
      where: {
        id: { not: scambio.id },
        stato: "PENDING",
        OR: [
          { giocatoreOffertoId: { in: [scambio.giocatoreOffertoId, scambio.giocatoreRichiestoId] } },
          { giocatoreRichiestoId: { in: [scambio.giocatoreOffertoId, scambio.giocatoreRichiestoId] } },
        ],
      },
      data: { stato: "ANNULLATA" },
    }),
  ]);

  const aggiornato = await prisma.richiestaScambio.findUnique({
    where: { id: scambio.id },
    include: { squadraProponente: true, squadraRicevente: true, giocatoreOfferto: true, giocatoreRichiesto: true },
  });
  res.json(aggiornato);
});

// Rifiuta uno scambio ricevuto
router.post("/:id/rifiuta", async (req, res) => {
  const userId = req.user!.userId;
  const scambioBase = await prisma.richiestaScambio.findUnique({ where: { id: req.params.id } });
  if (!scambioBase) return res.status(404).json({ error: "Scambio non trovato" });

  const ricevente = await prisma.squadra.findUnique({ where: { id: scambioBase.squadraRiceventeId } });
  if (!ricevente || ricevente.userId !== userId) {
    return res.status(403).json({ error: "Solo la squadra ricevente puo' rifiutare questo scambio" });
  }

  const check = await trovaScambioPendingConSquadra(req.params.id, ricevente.id, "squadraRiceventeId");
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  const aggiornato = await prisma.richiestaScambio.update({ where: { id: req.params.id }, data: { stato: "RIFIUTATA" } });
  res.json(aggiornato);
});

// Annulla uno scambio proposto (solo chi l'ha proposto, finche' e' in attesa)
router.delete("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const scambioBase = await prisma.richiestaScambio.findUnique({ where: { id: req.params.id } });
  if (!scambioBase) return res.status(404).json({ error: "Scambio non trovato" });

  const proponente = await prisma.squadra.findUnique({ where: { id: scambioBase.squadraProponenteId } });
  if (!proponente || proponente.userId !== userId) {
    return res.status(403).json({ error: "Solo chi ha proposto lo scambio puo' annullarlo" });
  }

  const check = await trovaScambioPendingConSquadra(req.params.id, proponente.id, "squadraProponenteId");
  if (!check.ok) return res.status(check.status).json({ error: check.error });

  await prisma.richiestaScambio.update({ where: { id: req.params.id }, data: { stato: "ANNULLATA" } });
  res.status(204).send();
});

export default router;
