# Fantacalcio

App web completa per gestire una lega di fantacalcio tra amici: aste/rose, formazioni,
calendario a girone all'italiana, classifica e punteggi calcolati a partire da dati
**live gratuiti** di Serie A.

> **Vuoi solo vedere il sito online, senza installare nulla sul tuo computer?**
> Segui **[DEPLOY.md](./DEPLOY.md)**: in 15-20 minuti pubblichi tutto gratis
> (Render + Neon + Vercel) e ottieni un link da aprire da telefono o PC.

## Architettura

```
backend/    API REST — Node.js + TypeScript + Express + Prisma + PostgreSQL
frontend/   Web app — React + TypeScript + Vite (React Router)
```

Monorepo npm workspaces: un solo `npm install` alla radice installa entrambi i progetti.

- **Autenticazione**: email/password con JWT, multi-utente.
- **Leghe**: crea una lega con codice invito, gli amici entrano con quel codice; ogni
  utente ha una squadra per lega. Subito dopo la creazione, l'admin passa da un
  **wizard di configurazione** (`/leghe/:id/setup`) dove sceglie i moduli ammessi, la
  **modalità classifica** (scontri diretti oppure a punti, vedi sotto), se attivare il
  modificatore difesa, il bonus MVP di giornata e la modalità carte bonus.
- **Modalità classifica** (scelta una sola volta nel wizard, cambiabile in seguito): con
  **"Scontri diretti"** (default) i partecipanti si sfidano uno contro uno ogni giornata
  sul calendario a girone all'italiana, punti-partita 3/1/0 come nel calcio vero. Con
  **"Modalità a punti"** non c'è nessuno scontro diretto: la classifica somma i fantapunti
  totali fatti da ogni squadra in tutta la stagione (stile Leghe FC) e vince chi ne ha
  di più a fine campionato (vedi `GET /api/leghe/:id/classifica` in `routes/leghe.ts`,
  che calcola l'uno o l'altro a seconda di `lega.modalitaClassifica`).
- **Rose gestite dall'admin**: solo l'amministratore della lega può assegnare o togliere
  giocatori dalle rose dei partecipanti (non è più un'asta self-service). Lo fa dalla
  sezione **Mercato**; un giocatore non può appartenere a due squadre della stessa lega.
- **Mercato**: sezione dedicata (`/leghe/:id/mercato`) che l'admin può aprire per un
  periodo configurabile fino a **30 giorni**. A mercato aperto l'admin gestisce le rose
  di tutte le squadre, e i partecipanti possono proporsi scambi di giocatori a vicenda
  (con eventuale conguaglio in crediti); l'accettazione scambia la proprietà dei due
  giocatori in una transazione atomica (vedi `backend/src/routes/scambi.ts`). L'admin
  può assegnare/togliere giocatori anche a mercato chiuso; solo gli scambi tra
  partecipanti richiedono il mercato aperto.
- **Calendario**: generato automaticamente a girone all'italiana (round robin) non appena
  la lega raggiunge **8 squadre iscritte** (scatta una volta sola per non azzerare punteggi
  già calcolati se altri si iscrivono dopo). L'admin può comunque generarlo prima (bastano
  **almeno 3 squadre**), o rigenerarlo in qualsiasi momento dalla sezione "Amministrazione lega".
- **Formazioni**: scegli modulo (solo tra quelli ammessi dalla lega, nessun modulo
  preselezionato: il salvataggio resta disabilitato finché non lo scegli tu) e
  titolari/panchina rispettando gli schemi classici (3-4-3, 4-3-3, ecc.), con
  validazione dei ruoli. I giocatori si schierano come card "Campioncino" in stile
  Ultimate Team (colore per ruolo, quotazione come rating, un click per
  titolare/panchina). Le scelte restano valide di giornata in giornata: se non hai
  ancora schierato una formazione per la giornata corrente, l'app propone in automatico
  l'ultima usata (`GET /api/formazioni/:squadraId/precedente/:giornataId`) così non
  riparti mai da zero. La formazione di una giornata è modificabile solo a partire da
  un paio d'ore dopo che l'admin ha calcolato i punteggi della giornata precedente (e
  non più una volta che la giornata stessa è conclusa) — vedi
  `backend/src/lib/formazioneLock.ts`, applicato sia lato server (`PUT /api/formazioni`)
  sia in UI.
- **Pacchetto settimanale (modalità carte bonus)**: se la lega ha questa modalità attiva
  (scelta nel wizard, modificabile in seguito), una volta a giornata ogni squadra può
  aprire un pacchetto che estrae a caso un giocatore della propria rosa. Se quel
  giocatore viene schierato titolare in una giornata riceve **+1** al voto finale; se non
  gioca, la carta bonus resta valida e si attiva automaticamente alla prima giornata
  utile in cui viene schierato (vedi `backend/src/routes/squadre.ts`, endpoint
  `/pacchetto` e `/carte`, e la logica di attivazione idempotente in
  `services/scoring.ts`). Se la lega usa la **modalità classica** invece, questa sezione
  non compare e nessun bonus pacchetto viene applicato.
- **Modificatore difesa** (opzionale, stile Leghe FC): bonus/malus alla formazione in
  base alla media voto di portiere e difensori titolari (+3/+2/+1/0/-1 a seconda della
  soglia, vedi `SOGLIE_MODIFICATORE_DIFESA` in `backend/src/types/domain.ts`).
- **Bonus MVP di giornata** (opzionale): la formazione che schiera titolare il giocatore
  con il voto più alto della giornata, nella propria lega, riceve **+1** punto extra.
- **Punteggi e classifica**: dalla sezione "Amministrazione lega" l'admin preme
  **"Calcola punteggi (giornata N)"**, che calcola i fantavoti dei giocatori dagli
  eventi reali della partita (dato globale, condiviso tra tutte le leghe), somma i punti
  della formazione schierata applicando le impostazioni **della singola lega** (carte
  bonus, modificatore difesa, bonus mvp — nessuna delle tre influenza mai il punteggio
  calcolato in un'altra lega), aggiorna la classifica secondo la modalità scelta, e marca
  la giornata come **conclusa** (`POST /api/giornate/:id/concludi`): questo è anche il
  segnale che, un paio d'ore dopo, sblocca la formazione della giornata successiva.
- **Dettaglio giocatore**: cliccando sul nome di un giocatore (pagina "Giocatori & Live"
  e nella tua rosa) si apre un pannello con le statistiche stagionali — gol, assist,
  rigori segnati/sbagliati, partite totali giocate in generale nella stagione (quante
  giornate sono state calcolate finora) affiancate alle partite giocate dal giocatore —
  e uno storico partita per partita con un pallino colorato per ciascuna giornata:
  🟢 verde = titolare, 🟠 arancione = subentrato, 🔴 rosso = non ha giocato, 🩵 ciano =
  infortunio (`GET /api/giocatori/:id/statistiche`). Lo stato di presenza è stimato in
  modo deterministico (vedi `backend/src/lib/presenza.ts`): se il giocatore ha eventi
  registrati (gol/assist/cartellino/rigore) sappiamo per certo che ha giocato; altrimenti,
  poiché il piano gratuito di football-data.org non fornisce le distinte ufficiali, in
  modalità reale resta onestamente "non ha giocato", mentre in **modalità DEMO** viene
  simulato tra tutti e quattro gli stati per rendere la funzionalità dimostrabile.

## Dati dei giocatori: cosa è incluso e cosa no

Il database viene seedato con **472 giocatori reali delle 20 squadre di Serie A
2025/26** (nome, squadra, ruolo), compilati da fonti pubbliche (rose ufficiali/Wikipedia/
Transfermarkt). Vedi `backend/src/seed/seriea_players_2025_26.csv`.

Ogni giocatore ha anche una **quotazione iniziale approssimativa** (crediti su base 500,
come nel classico listone), pensata come punto di partenza per l'asta: qualche decina di
giocatori noti ha un valore indicativo assegnato a mano, tutti gli altri hanno un valore
generato in modo deterministico per ruolo (i portieri/difensori restano più economici, gli
attaccanti/centrocampisti da titolare arrivano più in alto). **Non è il listone ufficiale**
con i prezzi reali di mercato: è solo una base plausibile da cui partire, modificabile
liberamente offerta per offerta durante l'asta in-app. Il "listone" ufficiale con i prezzi
reali (il materiale proprietario che siti come Fantacalcio.it pubblicano gratuitamente
ogni estate) **non è incluso** di proposito, perché non può essere redistribuito da terzi.
**Non c'è un pulsante nell'interfaccia per caricarlo**: di proposito, per evitare che un
qualsiasi admin di lega carichi per sbaglio (o di proposito) dati che non dovrebbe
ridistribuire. L'endpoint per l'import esiste comunque lato backend
(`POST /api/giocatori/import`, autenticato, si aspetta un CSV
`nome,squadra,ruolo,quotazione,immagine` — l'ultima colonna opzionale, vedi
`backend/src/seed/seriea_players_2025_26.csv` come esempio di formato senza quella
colonna) ed è pensato per essere usato direttamente da chi gestisce il deploy quando ha
in mano il file reale, non esposto come funzione self-service per gli admin di lega.

Analogamente i **voti ufficiali** dei giornalisti (Gazzetta, Fantacalcio.it) dopo ogni
giornata sono un prodotto a pagamento e non vengono usati: il punteggio in questa app è
calcolato "ad eventi" (vedi sotto).

### Immagini dei "campioncini"

Le card giocatore (vedi sotto) partono senza foto: mostrano un avatar con le iniziali del
nome su sfondo colorato per ruolo. Per aggiungere le tue immagini in un secondo momento,
senza toccare il codice, basta valorizzare il campo `immagineUrl` di ogni giocatore in uno
di questi due modi:

1. **In blocco via CSV**: aggiungi una quinta colonna `immagine` al CSV di
   `POST /api/giocatori/import` (`nome,squadra,ruolo,quotazione,immagine`) con l'URL di
   ogni immagine. Può essere un URL esterno (`https://...`) oppure un path servito
   staticamente dal frontend, ad es. metti i file in `frontend/public/players/` e scrivi
   `/players/lautaro-martinez.jpg` nella colonna.
2. **Giocatore per giocatore**: `PATCH /api/giocatori/:id/immagine` con body
   `{ "immagineUrl": "https://..." }` (o `null` per rimuoverla).

Anche questo, come il listone, non ha un pulsante dedicato nell'interfaccia: è pensato
per essere eseguito da chi gestisce il deploy (es. con `curl` o uno script) quando ha le
immagini pronte, non come funzione self-service per gli admin di lega.

Se un URL non carica, la card torna automaticamente all'avatar con le iniziali — nessun
giocatore resta con un'immagine rotta.

## Dati live: come funzionano

Il backend usa l'API gratuita **[football-data.org](https://www.football-data.org/)**
(competizione Serie A = `SA`, inclusa nel piano free, limite 10 richieste/minuto).

- Senza una API key configurata, l'app parte in **modalità DEMO**: genera partite e
  risultati simulati (chiaramente etichettati "DEMO" nell'interfaccia) così puoi provare
  tutto il flusso (asta, formazioni, classifica) senza costi né account esterni.
- Con una API key gratuita (registrazione su football-data.org), l'app scarica
  risultati reali della Serie A e li usa per calcolare i punti.

**Limite importante**: il piano gratuito di football-data.org spesso non include il
dettaglio di marcatori/cartellini per tutte le partite. Quando questi dati mancano, il
punteggio di un giocatore si basa solo su un bonus/malus di squadra (porta imbattuta,
tanti gol subiti). Quando i dettagli sono disponibili, si sommano bonus per gol, assist,
cartellini, rigori (vedi `backend/src/types/domain.ts`, costante `BONUS_MALUS`). Questo
**non è il voto ufficiale del giornalista**, ma un punteggio "ad eventi" calcolato dal
risultato reale della partita — l'opzione più seria disponibile senza pagare un servizio
dati a pagamento.

Un cron interno (`node-cron`, ogni 3 minuti) risincronizza la giornata corrente in modo
automatico durante le partite.

## Setup (sviluppo locale)

Requisiti: Node.js 20+ e un database PostgreSQL raggiungibile (va benissimo un
progetto gratuito su [neon.tech](https://neon.tech), oppure Postgres locale/Docker).

```bash
# Dalla radice del repo
npm install

# Backend: configura l'ambiente
cd backend
cp .env.example .env
# apri .env e incolla la tua stringa di connessione Postgres in DATABASE_URL
# (opzionale) incolla FOOTBALL_DATA_API_KEY se ne hai una

# Crea le tabelle sul database
npx prisma db push

# Popola i 472 giocatori Serie A 2025/26 (si esegue anche da sola al primo
# avvio del server se il database e' vuoto, ma puoi lanciarla anche a mano)
npm run seed
```

Avvia backend e frontend in due terminali separati (dalla radice del repo):

```bash
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173
```

Apri http://localhost:5173, registra un account, crea una lega, condividi il codice
invito con gli amici.

### Ottenere una API key gratuita per i dati live reali

1. Registrati su https://www.football-data.org/client/register (gratuito).
2. Copia la API key ricevuta via email.
3. Incollala in `backend/.env` come `FOOTBALL_DATA_API_KEY=...`.
4. Riavvia il backend.

## Struttura del backend

```
backend/src/
  server.ts              entrypoint Express
  routes/                auth, leghe, squadre, giocatori, giornate, formazioni, live, scambi
  services/
    footballData.ts      client API football-data.org
    demoData.ts           generatore di partite finte (modalità demo)
    scoring.ts            calcolo fantavoti, punteggio formazioni, scontri diretti
    calendario.ts          generazione calendario round robin
    cronJob.ts             sync periodica della giornata corrente
  seed/                    dataset giocatori + script di seed (auto-eseguito da server.ts se il DB e' vuoto)
  prisma/schema.prisma      modello dati (PostgreSQL)
```

## Struttura del frontend

```
frontend/src/
  api/          client fetch + tipi condivisi con il backend
  context/      AuthContext (sessione), ToastContext (notifiche animate)
  hooks/        useDocumentTitle, useCountUp
  pages/        Login, Register, Dashboard, Lega, LegaSetup (wizard), Mercato, Squadra,
                Giocatori (live), Formazione
  components/   Layout, ProtectedRoute, PlayerCard (campioncino con tilt 3D),
                PackOpening (apertura pacchetto animata), Confetti, Skeleton,
                GiocatoreStatsModal (dettaglio + storico presenze)
```

## Limiti noti e possibili estensioni future

- Il matching giocatore↔evento tra football-data.org e il nostro database è
  "best effort" per nome (normalizzazione + confronto cognome): con nomi ambigui può
  sbagliare. Un pannello admin per correggere manualmente gli abbinamenti sarebbe il
  prossimo passo naturale.
- Il calcolo del punteggio formazione non implementa ancora le sostituzioni automatiche
  dalla panchina in caso di titolare che non ha giocato. Il "modificatore difesa" incluso
  è una versione semplificata ispirata a Leghe FC, non il regolamento ufficiale
  Fantacalcio.it.
- Per pubblicare il sito online gratis (Render + Neon + Vercel) segui **[DEPLOY.md](./DEPLOY.md)**.
  Il piano gratuito di Render mette in pausa il backend dopo 15 minuti di inattività: la
  prima richiesta dopo una pausa lunga può impiegare 30-50 secondi.
- Le migrazioni Prisma tracciate sono state sostituite da `prisma db push` per
  semplicità di deploy: va benissimo per un progetto di questa dimensione, ma se il
  progetto cresce e serve una vera cronologia di migrazioni reversibili, si può tornare a
  `prisma migrate dev` in qualsiasi momento (basta avere una connessione Postgres
  raggiungibile per generarle).
