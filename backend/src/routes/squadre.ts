import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

type CheckSquadra =
  | { ok: true; squadra: NonNullable<Awaited<ReturnType<typeof prisma.squadra.findUnique>>> }
  | { ok: false; error: string; status: number };

async function assertProprietario(squadraId: string, userId: string): Promise<CheckSquadra> {
  const squadra = await prisma.squadra.findUnique({ where: { id: squadraId } });
  if (!squadra) return { ok: false, error: "Squadra non trovata", status: 404 };
  if (squadra.userId !== userId) return { ok: false, error: "Non sei il proprietario di questa squadra", status: 403 };
  return { ok: true, squadra };
}

// Solo l'admin della lega a cui appartiene la squadra puo' assegnare/togliere
// giocatori: l'asta/mercato non e' piu' self-service per i partecipanti.
async function assertAdminDellaLega(squadraId: string, userId: string): Promise<CheckSquadra> {
  const squadra = await prisma.squadra.findUnique({ where: { id: squadraId } });
  if (!squadra) return { ok: false, error: "Squadra non trovata", status: 404 };
  const lega = await prisma.lega.findUnique({ where: { id: squadra.legaId } });
  if (!lega || lega.adminId !== userId) {
    return { ok: false, error: "Solo l'amministratore della lega puo' gestire i giocatori delle squadre", status: 403 };
  }
  return { ok: true, squadra };
}

// Dettaglio squadra, con le impostazioni della lega di appartenenza (usato dal
// frontend per sapere se le carte bonus sono attive e quali moduli sono ammessi)
router.get("/:id", async (req, res) => {
  const userId = req.user!.userId;
  const squadra = await prisma.squadra.findUnique({ where: { id: req.params.id }, include: { lega: true } });
  if (!squadra) return res.status(404).json({ error: "Squadra non trovata" });
  const membro = await prisma.squadra.findFirst({ where: { legaId: squadra.legaId, userId } });
  if (!membro) return res.status(403).json({ error: "Non fai parte di questa lega" });
  res.json(squadra);
});

// Rosa di una squadra
router.get("/:id/rosa", async (req, res) => {
  const rosa = await prisma.rosaGiocatore.findMany({
    where: { squadraId: req.params.id },
    include: { giocatore: true },
    orderBy: { giocatore: { ruolo: "asc" } },
  });
  res.json(rosa);
});

const acquistoSchema = z.object({
  giocatoreId: z.string(),
  prezzo: z.number().int().min(0),
});

// Assegna un giocatore alla rosa di una squadra: solo l'admin della lega puo'
// farlo (asta/mercato non e' self-service per i partecipanti).
router.post("/:id/rosa", async (req, res) => {
  const userId = req.user!.userId;
  const check = await assertAdminDellaLega(req.params.id, userId);
  if ("error" in check) return res.status(check.status).json({ error: check.error });
  const squadra = check.squadra;

  const parsed = acquistoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { giocatoreId, prezzo } = parsed.data;

  const giocatore = await prisma.giocatore.findUnique({ where: { id: giocatoreId } });
  if (!giocatore) return res.status(404).json({ error: "Giocatore non trovato" });

  if (prezzo > squadra.budgetResiduo) {
    return res.status(400).json({ error: "Budget residuo insufficiente" });
  }

  // Il giocatore non puo' gia' appartenere a un'altra squadra della stessa lega
  const squadreLega = await prisma.squadra.findMany({ where: { legaId: squadra.legaId }, select: { id: true } });
  const giaAssegnato = await prisma.rosaGiocatore.findFirst({
    where: { giocatoreId, squadraId: { in: squadreLega.map((s) => s.id) } },
  });
  if (giaAssegnato) {
    return res.status(409).json({ error: "Giocatore gia' assegnato a un'altra squadra della lega" });
  }

  const [rosaEntry] = await prisma.$transaction([
    prisma.rosaGiocatore.create({
      data: { squadraId: squadra.id, giocatoreId, prezzoPagato: prezzo },
      include: { giocatore: true },
    }),
    prisma.squadra.update({
      where: { id: squadra.id },
      data: { budgetResiduo: { decrement: prezzo } },
    }),
  ]);

  res.status(201).json(rosaEntry);
});

// Svincola un giocatore dalla rosa (rimborsa il budget): solo l'admin della lega
router.delete("/:id/rosa/:rosaId", async (req, res) => {
  const userId = req.user!.userId;
  const check = await assertAdminDellaLega(req.params.id, userId);
  if ("error" in check) return res.status(check.status).json({ error: check.error });

  const entry = await prisma.rosaGiocatore.findUnique({ where: { id: req.params.rosaId } });
  if (!entry || entry.squadraId !== req.params.id) {
    return res.status(404).json({ error: "Elemento rosa non trovato" });
  }

  await prisma.$transaction([
    prisma.rosaGiocatore.delete({ where: { id: entry.id } }),
    prisma.squadra.update({
      where: { id: req.params.id },
      data: { budgetResiduo: { increment: entry.prezzoPagato } },
    }),
  ]);

  res.status(204).send();
});

// Giocatori ancora svincolati (liberi) all'interno di una lega
router.get("/:id/svincolati", async (req, res) => {
  const squadra = await prisma.squadra.findUnique({ where: { id: req.params.id } });
  if (!squadra) return res.status(404).json({ error: "Squadra non trovata" });

  const squadreLega = await prisma.squadra.findMany({ where: { legaId: squadra.legaId }, select: { id: true } });
  const assegnati = await prisma.rosaGiocatore.findMany({
    where: { squadraId: { in: squadreLega.map((s) => s.id) } },
    select: { giocatoreId: true },
  });
  const idAssegnati = assegnati.map((a) => a.giocatoreId);

  const svincolati = await prisma.giocatore.findMany({
    where: { id: { notIn: idAssegnati }, attivo: true },
    orderBy: [{ ruolo: "asc" }, { nome: "asc" }],
  });

  res.json(svincolati);
});

const pacchettoSchema = z.object({ giornataId: z.string() });

// Apre il pacchetto settimanale "campioncino": estrae un giocatore casuale
// dalla rosa della squadra. Un solo pacchetto per squadra per giornata.
router.post("/:id/pacchetto", async (req, res) => {
  const userId = req.user!.userId;
  const check = await assertProprietario(req.params.id, userId);
  if ("error" in check) return res.status(check.status).json({ error: check.error });
  const squadra = check.squadra;

  const parsed = pacchettoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { giornataId } = parsed.data;

  const lega = await prisma.lega.findUnique({ where: { id: squadra.legaId } });
  if (!lega?.cartebonusAttive) {
    return res.status(403).json({ error: "La modalita' carte bonus non e' attiva in questa lega" });
  }

  const giornata = await prisma.giornata.findUnique({ where: { id: giornataId } });
  if (!giornata) return res.status(404).json({ error: "Giornata non trovata" });

  const giaAperto = await prisma.cartaBonus.findUnique({
    where: { squadraId_giornataAperturaId: { squadraId: squadra.id, giornataAperturaId: giornataId } },
  });
  if (giaAperto) {
    return res.status(409).json({ error: "Hai gia' aperto il pacchetto di questa giornata" });
  }

  const rosa = await prisma.rosaGiocatore.findMany({ where: { squadraId: squadra.id }, include: { giocatore: true } });
  if (rosa.length === 0) {
    return res.status(400).json({ error: "La tua rosa e' vuota: acquista dei giocatori prima di aprire un pacchetto" });
  }

  const estratto = rosa[Math.floor(Math.random() * rosa.length)];

  const carta = await prisma.cartaBonus.create({
    data: { squadraId: squadra.id, giocatoreId: estratto.giocatoreId, giornataAperturaId: giornataId },
    include: { giocatore: true },
  });

  res.status(201).json(carta);
});

// Elenco delle carte bonus della squadra (in attesa e gia' utilizzate)
router.get("/:id/carte", async (req, res) => {
  const carte = await prisma.cartaBonus.findMany({
    where: { squadraId: req.params.id },
    include: { giocatore: true, giornataApertura: true, giornataUtilizzo: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(carte);
});

export default router;
