import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { generateInviteCode } from "../lib/inviteCode";
import { generaCalendarioLega } from "../services/calendario";
import { MIN_SQUADRE_CALENDARIO_AUTO, MERCATO_DURATA_MAX_GIORNI, MODULI_VALIDI } from "../types/domain";

const router = Router();
router.use(requireAuth);

const creaLegaSchema = z.object({
  nome: z.string().min(2),
  budgetIniziale: z.number().int().positive().default(500),
  nomeSquadra: z.string().min(2),
});

// Crea una nuova lega e la squadra dell'admin al suo interno
router.post("/", async (req, res) => {
  const parsed = creaLegaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { nome, budgetIniziale, nomeSquadra } = parsed.data;
  const userId = req.user!.userId;

  let codiceInvito = generateInviteCode();
  for (let tentativi = 0; tentativi < 5; tentativi++) {
    const esiste = await prisma.lega.findUnique({ where: { codiceInvito } });
    if (!esiste) break;
    codiceInvito = generateInviteCode();
  }

  const lega = await prisma.lega.create({
    data: {
      nome,
      budgetIniziale,
      codiceInvito,
      adminId: userId,
      squadre: {
        create: {
          nome: nomeSquadra,
          userId,
          budgetResiduo: budgetIniziale,
        },
      },
    },
    include: { squadre: true },
  });

  res.status(201).json(lega);
});

const joinSchema = z.object({
  codiceInvito: z.string().min(4),
  nomeSquadra: z.string().min(2),
});

// Entra in una lega esistente tramite codice invito
router.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { codiceInvito, nomeSquadra } = parsed.data;
  const userId = req.user!.userId;

  const lega = await prisma.lega.findUnique({ where: { codiceInvito } });
  if (!lega) {
    return res.status(404).json({ error: "Codice invito non valido" });
  }

  const giaIscritto = await prisma.squadra.findUnique({
    where: { legaId_userId: { legaId: lega.id, userId } },
  });
  if (giaIscritto) {
    return res.status(409).json({ error: "Sei gia' iscritto a questa lega" });
  }

  const squadra = await prisma.squadra.create({
    data: {
      nome: nomeSquadra,
      legaId: lega.id,
      userId,
      budgetResiduo: lega.budgetIniziale,
    },
  });

  // Appena la lega raggiunge il numero minimo di squadre, generiamo da soli
  // il calendario a girone all'italiana: nessun admin deve ricordarsi di
  // farlo a mano. Scatta una volta sola (al superamento esatto della soglia)
  // per non rigenerare/azzerare punteggi gia' calcolati se altri si iscrivono dopo.
  let calendarioGenerato = false;
  const numeroSquadre = await prisma.squadra.count({ where: { legaId: lega.id } });
  if (numeroSquadre === MIN_SQUADRE_CALENDARIO_AUTO) {
    try {
      await generaCalendarioLega(lega.id);
      calendarioGenerato = true;
    } catch (err) {
      console.error("Generazione automatica calendario fallita:", (err as Error).message);
    }
  }

  res.status(201).json({ lega, squadra, calendarioGenerato });
});

// Elenco leghe dell'utente autenticato
router.get("/", async (req, res) => {
  const userId = req.user!.userId;
  const squadre = await prisma.squadra.findMany({
    where: { userId },
    include: { lega: true },
  });
  res.json(squadre.map((s) => ({ ...s.lega, miaSquadraId: s.id })));
});

// Dettaglio lega: squadre iscritte e classifica
router.get("/:id", async (req, res) => {
  const userId = req.user!.userId;
  let lega = await prisma.lega.findUnique({
    where: { id: req.params.id },
    include: { squadre: { include: { utente: true } } },
  });
  if (!lega) return res.status(404).json({ error: "Lega non trovata" });
  if (!lega.squadre.some((s) => s.userId === userId)) {
    return res.status(403).json({ error: "Non fai parte di questa lega" });
  }

  // Chiude automaticamente il mercato se la data limite e' passata
  if (lega.mercatoAperto && lega.mercatoChiusuraAt && lega.mercatoChiusuraAt < new Date()) {
    lega = await prisma.lega.update({
      where: { id: lega.id },
      data: { mercatoAperto: false },
      include: { squadre: { include: { utente: true } } },
    });
  }

  res.json(lega);
});

// Classifica: aggrega i punteggi di tutti gli scontri diretti conclusi
router.get("/:id/classifica", async (req, res) => {
  const userId = req.user!.userId;
  const legaId = req.params.id;

  const squadre = await prisma.squadra.findMany({ where: { legaId } });
  if (!squadre.some((s) => s.userId === userId)) {
    return res.status(403).json({ error: "Non fai parte di questa lega" });
  }

  const scontri = await prisma.scontro.findMany({
    where: { legaId, punteggioCasa: { not: null }, punteggioTrasf: { not: null } },
  });

  const tabella = new Map<
    string,
    { squadraId: string; punti: number; vinte: number; pareggiate: number; perse: number; fatti: number; subiti: number }
  >();
  for (const s of squadre) {
    tabella.set(s.id, { squadraId: s.id, punti: 0, vinte: 0, pareggiate: 0, perse: 0, fatti: 0, subiti: 0 });
  }

  for (const sc of scontri) {
    const casa = tabella.get(sc.squadraCasaId);
    const trasf = tabella.get(sc.squadraTrasfId);
    if (!casa || !trasf) continue;
    const pc = sc.punteggioCasa!;
    const pt = sc.punteggioTrasf!;
    casa.fatti += pc;
    casa.subiti += pt;
    trasf.fatti += pt;
    trasf.subiti += pc;
    if (pc > pt) {
      casa.punti += 3;
      casa.vinte += 1;
      trasf.perse += 1;
    } else if (pc < pt) {
      trasf.punti += 3;
      trasf.vinte += 1;
      casa.perse += 1;
    } else {
      casa.punti += 1;
      trasf.punti += 1;
      casa.pareggiate += 1;
      trasf.pareggiate += 1;
    }
  }

  const classifica = Array.from(tabella.values())
    .map((riga) => ({
      ...riga,
      squadra: squadre.find((s) => s.id === riga.squadraId),
      differenza: riga.fatti - riga.subiti,
    }))
    .sort((a, b) => b.punti - a.punti || b.differenza - a.differenza);

  res.json(classifica);
});

const impostazioniSchema = z.object({
  moduliConsentiti: z.array(z.enum(MODULI_VALIDI)).min(1),
  modificatoreDifesa: z.boolean(),
  bonusMvp: z.boolean(),
  cartebonusAttive: z.boolean(),
});

// Wizard di configurazione della lega, compilato dall'admin subito dopo la
// creazione (moduli ammessi, modificatore difesa, bonus mvp, carte bonus).
router.patch("/:id/impostazioni", async (req, res) => {
  const userId = req.user!.userId;
  const lega = await prisma.lega.findUnique({ where: { id: req.params.id } });
  if (!lega) return res.status(404).json({ error: "Lega non trovata" });
  if (lega.adminId !== userId) {
    return res.status(403).json({ error: "Solo l'admin della lega puo' modificarne le impostazioni" });
  }

  const parsed = impostazioniSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const aggiornata = await prisma.lega.update({
    where: { id: lega.id },
    data: { ...parsed.data, impostazioniCompletate: true },
  });
  res.json(aggiornata);
});

const mercatoSchema = z.union([
  z.object({ apri: z.literal(true), durataGiorni: z.number().int().min(1).max(MERCATO_DURATA_MAX_GIORNI) }),
  z.object({ apri: z.literal(false) }),
]);

// Apre/chiude il "Mercato" della lega. L'apertura ha una durata massima di un
// mese; da aperto l'admin puo' gestire le rose di tutte le squadre e i
// partecipanti possono proporsi scambi (vedi routes/scambi.ts).
router.patch("/:id/mercato", async (req, res) => {
  const userId = req.user!.userId;
  const lega = await prisma.lega.findUnique({ where: { id: req.params.id } });
  if (!lega) return res.status(404).json({ error: "Lega non trovata" });
  if (lega.adminId !== userId) {
    return res.status(403).json({ error: "Solo l'admin della lega puo' gestire il mercato" });
  }

  const parsed = mercatoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const data = parsed.data.apri
    ? { mercatoAperto: true, mercatoChiusuraAt: new Date(Date.now() + parsed.data.durataGiorni * 24 * 60 * 60 * 1000) }
    : { mercatoAperto: false, mercatoChiusuraAt: null };

  const aggiornata = await prisma.lega.update({ where: { id: lega.id }, data });
  res.json(aggiornata);
});

export default router;
