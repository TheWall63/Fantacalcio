import { prisma } from "../lib/prisma";
import { fetchGiornataSerieA, isLiveDataConfigured, PartitaEsterna } from "./footballData";
import { generaGiornataDemo } from "./demoData";
import { trovaSquadraDaNomeEsterno } from "../config/squadreSerieA";
import { stessoGiocatore } from "../lib/matching";
import { BONUS_MALUS, TipoEvento, SOGLIE_MODIFICATORE_DIFESA } from "../types/domain";

export interface SyncResult {
  demo: boolean;
  partiteAggiornate: number;
  giocatoriValutati: number;
}

// Sincronizza i dati live di una giornata: recupera le partite (reali o demo),
// le salva, ricalcola i fantavoti dei giocatori coinvolti, il punteggio delle
// formazioni schierate e il risultato degli scontri diretti della lega.
export async function sincronizzaGiornata(giornataId: string): Promise<SyncResult> {
  const giornata = await prisma.giornata.findUnique({ where: { id: giornataId } });
  if (!giornata) throw new Error("Giornata non trovata");

  const demo = !isLiveDataConfigured();
  const partiteEsterne: PartitaEsterna[] = demo
    ? generaGiornataDemo(giornata.numero)
    : await fetchGiornataSerieA(giornata.numero);

  for (const pe of partiteEsterne) {
    const partita = await prisma.partita.upsert({
      where: { externalId: pe.externalId },
      create: {
        giornataId,
        externalId: pe.externalId,
        squadraCasa: trovaSquadraDaNomeEsterno(pe.squadraCasa) ?? pe.squadraCasa,
        squadraTrasf: trovaSquadraDaNomeEsterno(pe.squadraTrasf) ?? pe.squadraTrasf,
        golCasa: pe.golCasa,
        golTrasf: pe.golTrasf,
        stato: pe.stato,
        dataOra: new Date(pe.dataOra),
      },
      update: {
        golCasa: pe.golCasa,
        golTrasf: pe.golTrasf,
        stato: pe.stato,
      },
    });

    // Ripartiamo puliti sugli eventi per evitare doppi conteggi ad ogni sync
    await prisma.eventoPartita.deleteMany({ where: { partitaId: partita.id } });
    if (pe.eventi.length > 0) {
      await prisma.eventoPartita.createMany({
        data: await Promise.all(
          pe.eventi.map(async (ev) => ({
            partitaId: partita.id,
            tipo: ev.tipo,
            minuto: ev.minuto,
            squadra: trovaSquadraDaNomeEsterno(ev.squadra) ?? ev.squadra,
            giocatoreId: ev.giocatoreNome ? await risolviGiocatore(ev.giocatoreNome) : null,
          }))
        ),
      });
    }
  }

  const giocatoriValutati = await calcolaPunteggiGiornata(giornataId);
  await calcolaPunteggiFormazioni(giornataId);
  await calcolaScontriDiretti(giornataId);

  return { demo, partiteAggiornate: partiteEsterne.length, giocatoriValutati };
}

async function risolviGiocatore(nomeEsterno: string): Promise<string | null> {
  // Matching best-effort: l'API gratuita non fornisce ID giocatore stabili,
  // quindi confrontiamo i nomi normalizzati contro il nostro DB (listone).
  const candidati = await prisma.giocatore.findMany({ select: { id: true, nome: true } });
  const match = candidati.find((c) => stessoGiocatore(c.nome, nomeEsterno));
  return match?.id ?? null;
}

async function calcolaPunteggiGiornata(giornataId: string): Promise<number> {
  const partite = await prisma.partita.findMany({
    where: { giornataId },
    include: { eventi: true },
  });

  // Base 6 per ogni giocatore delle squadre in campo in questa giornata
  // (semplificazione: l'API free non garantisce le formazioni titolari,
  // quindi assumiamo coinvolti tutti i giocatori attivi della squadra reale).
  const puntiPerGiocatore = new Map<string, number>();
  const squadreCoinvolte = new Set<string>();
  for (const p of partite) {
    squadreCoinvolte.add(p.squadraCasa);
    squadreCoinvolte.add(p.squadraTrasf);
  }

  const giocatoriCoinvolti = await prisma.giocatore.findMany({
    where: { squadraSerieA: { in: Array.from(squadreCoinvolte) }, attivo: true },
  });
  for (const g of giocatoriCoinvolti) puntiPerGiocatore.set(g.id, 6);

  for (const p of partite) {
    for (const ev of p.eventi) {
      if (!ev.giocatoreId) continue;
      const bonus = BONUS_MALUS[ev.tipo as TipoEvento] ?? 0;
      puntiPerGiocatore.set(ev.giocatoreId, (puntiPerGiocatore.get(ev.giocatoreId) ?? 6) + bonus);
    }

    // Bonus/malus di risultato per portieri e difensori (porta imbattuta / gol subiti)
    if (p.golCasa !== null && p.golTrasf !== null) {
      await applicaBonusRisultato(p.squadraCasa, p.golTrasf, puntiPerGiocatore);
      await applicaBonusRisultato(p.squadraTrasf, p.golCasa, puntiPerGiocatore);
    }
  }

  const voci = Array.from(puntiPerGiocatore.entries());
  for (const [giocatoreId, punti] of voci) {
    await prisma.punteggioGiocatore.upsert({
      where: { giornataId_giocatoreId: { giornataId, giocatoreId } },
      create: { giornataId, giocatoreId, punti },
      update: { punti },
    });
  }
  return voci.length;
}

async function applicaBonusRisultato(squadraSerieA: string, golSubiti: number, punti: Map<string, number>) {
  const portieriDifensori = await prisma.giocatore.findMany({
    where: { squadraSerieA, ruolo: { in: ["P", "D"] }, attivo: true },
  });
  const bonus = golSubiti === 0 ? 1 : golSubiti >= 3 ? -1 : 0;
  if (bonus === 0) return;
  for (const g of portieriDifensori) {
    punti.set(g.id, (punti.get(g.id) ?? 6) + bonus);
  }
}

// Il punteggio di ogni formazione dipende dalle impostazioni della SUA lega
// (carte bonus attive o no, modificatore difesa, bonus mvp): raggruppiamo per
// legaId cosi' le impostazioni di una lega non influenzano mai il punteggio
// di un'altra lega, anche quando condividono lo stesso giocatore/giornata
// (PunteggioGiocatore resta globale, questi bonus si sommano solo qui sopra).
async function calcolaPunteggiFormazioni(giornataId: string) {
  const formazioni = await prisma.formazione.findMany({
    where: { giornataId },
    include: { giocatori: { where: { slot: "TITOLARE" } }, squadra: true },
  });
  if (formazioni.length === 0) return;

  const legaIds = Array.from(new Set(formazioni.map((f) => f.squadra.legaId)));
  const leghe = await prisma.lega.findMany({ where: { id: { in: legaIds } } });
  const legaById = new Map(leghe.map((l) => [l.id, l]));

  const formazioniPerLega = new Map<string, typeof formazioni>();
  for (const f of formazioni) {
    const arr = formazioniPerLega.get(f.squadra.legaId) ?? [];
    arr.push(f);
    formazioniPerLega.set(f.squadra.legaId, arr);
  }

  for (const [legaId, formazioniLega] of formazioniPerLega) {
    const lega = legaById.get(legaId);
    if (!lega) continue;

    const tuttiTitolariIds = Array.from(new Set(formazioniLega.flatMap((f) => f.giocatori.map((g) => g.giocatoreId))));
    const [punteggiTitolari, giocatoriTitolari] = await Promise.all([
      prisma.punteggioGiocatore.findMany({ where: { giornataId, giocatoreId: { in: tuttiTitolariIds } } }),
      prisma.giocatore.findMany({ where: { id: { in: tuttiTitolariIds } }, select: { id: true, ruolo: true } }),
    ]);
    const puntiById = new Map(punteggiTitolari.map((p) => [p.giocatoreId, p.punti]));
    const ruoloById = new Map(giocatoriTitolari.map((g) => [g.id, g.ruolo]));

    // MVP di giornata per questa lega: il titolare col voto base piu' alto
    let mvpGiocatoreId: string | null = null;
    if (lega.bonusMvp) {
      let migliorPunti = -Infinity;
      for (const [gid, punti] of puntiById) {
        if (punti > migliorPunti) {
          migliorPunti = punti;
          mvpGiocatoreId = gid;
        }
      }
    }

    for (const f of formazioniLega) {
      const titolariIds = f.giocatori.map((g) => g.giocatoreId);
      const baseTotale = titolariIds.reduce((acc, gid) => acc + (puntiById.get(gid) ?? 0), 0);
      let bonusTotale = 0;

      // Carte bonus "campioncino": +1 per ogni carta il cui giocatore e'
      // titolare in questa giornata, solo se la lega usa questa modalita'.
      // Includiamo sia quelle ancora PENDING (si attivano ora) sia quelle gia'
      // USATA proprio su questa giornata, cosi' il ricalcolo resta idempotente
      // se la sync viene rilanciata piu' volte.
      if (lega.cartebonusAttive) {
        const carte = await prisma.cartaBonus.findMany({
          where: {
            squadraId: f.squadraId,
            giocatoreId: { in: titolariIds },
            OR: [{ stato: "PENDING" }, { stato: "USATA", giornataUtilizzoId: giornataId }],
          },
        });
        bonusTotale += carte.length;

        const daAttivare = carte.filter((c) => c.stato === "PENDING");
        for (const c of daAttivare) {
          await prisma.cartaBonus.update({ where: { id: c.id }, data: { stato: "USATA", giornataUtilizzoId: giornataId } });
        }
      }

      // Modificatore difesa: bonus/malus in base alla media voto dei titolari
      // portiere+difensori (stile Leghe FC).
      if (lega.modificatoreDifesa) {
        const votiPD = titolariIds
          .filter((gid) => ruoloById.get(gid) === "P" || ruoloById.get(gid) === "D")
          .map((gid) => puntiById.get(gid))
          .filter((p): p is number => p !== undefined);
        if (votiPD.length > 0) {
          const media = votiPD.reduce((acc, p) => acc + p, 0) / votiPD.length;
          const soglia = SOGLIE_MODIFICATORE_DIFESA.find((s) => media >= s.minMedia);
          bonusTotale += soglia?.bonus ?? 0;
        }
      }

      // Bonus MVP: +1 alla formazione che ha schierato titolare l'MVP di
      // giornata della lega.
      if (lega.bonusMvp && mvpGiocatoreId && titolariIds.includes(mvpGiocatoreId)) {
        bonusTotale += 1;
      }

      await prisma.formazione.update({ where: { id: f.id }, data: { punteggio: baseTotale + bonusTotale } });
    }
  }
}

async function calcolaScontriDiretti(giornataId: string) {
  const scontri = await prisma.scontro.findMany({ where: { giornataId } });
  for (const s of scontri) {
    const [fCasa, fTrasf] = await Promise.all([
      prisma.formazione.findUnique({ where: { squadraId_giornataId: { squadraId: s.squadraCasaId, giornataId } } }),
      prisma.formazione.findUnique({ where: { squadraId_giornataId: { squadraId: s.squadraTrasfId, giornataId } } }),
    ]);
    await prisma.scontro.update({
      where: { id: s.id },
      data: {
        punteggioCasa: fCasa?.punteggio ?? 0,
        punteggioTrasf: fTrasf?.punteggio ?? 0,
      },
    });
  }
}
