# Fantacalcio

App web completa per gestire una lega di fantacalcio tra amici: aste/rose, formazioni,
calendario a girone all'italiana, classifica e punteggi calcolati a partire da dati
**live gratuiti** di Serie A.

## Architettura

```
backend/    API REST — Node.js + TypeScript + Express + Prisma + SQLite
frontend/   Web app — React + TypeScript + Vite (React Router)
```

Monorepo npm workspaces: un solo `npm install` alla radice installa entrambi i progetti.

- **Autenticazione**: email/password con JWT, multi-utente.
- **Leghe**: crea una lega con codice invito, gli amici entrano con quel codice; ogni
  utente ha una squadra per lega.
- **Asta/mercato**: assegna giocatori alla tua rosa entro il budget della lega; un
  giocatore non può appartenere a due squadre della stessa lega.
- **Calendario**: generato automaticamente a girone all'italiana (round robin) su tutte
  le giornate della lega.
- **Formazioni**: scegli modulo e titolari/panchina rispettando gli schemi classici
  (3-4-3, 4-3-3, ecc.), con validazione dei ruoli. I giocatori si schierano come card
  "Campioncino" in stile Ultimate Team (colore per ruolo, quotazione come rating, un
  click per titolare/panchina).
- **Pacchetto settimanale**: una volta a giornata ogni squadra può aprire un pacchetto
  che estrae a caso un giocatore della propria rosa. Se quel giocatore viene schierato
  titolare in una giornata riceve **+1** al voto finale; se non gioca, la carta bonus
  resta valida e si attiva automaticamente alla prima giornata utile in cui viene
  schierato (vedi `backend/src/routes/squadre.ts`, endpoint `/pacchetto` e `/carte`, e
  la logica di attivazione idempotente in `services/scoring.ts`).
- **Punteggi e classifica**: la sincronizzazione di una giornata calcola i fantavoti dei
  giocatori dagli eventi reali della partita, somma i punti della formazione schierata
  (bonus pacchetto incluso) e aggiorna il risultato dello scontro diretto in classifica
  (3/1/0 punti come nel calcio vero).

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
Per importarlo quando esce e sovrascrivere le quotazioni approssimative:

1. Scarica il listone ufficiale (es. da fantacalcio.it, gratuito, formato Excel/CSV)
   quando esce ad agosto.
2. Convertilo/adattalo al formato CSV `nome,squadra,ruolo,quotazione` (vedi
   `backend/src/seed/seriea_players_2025_26.csv` come esempio di formato).
3. Da una lega di cui sei admin, sezione "Amministrazione lega" → "Importa listone", carica
   il file. L'import fa un upsert per nome giocatore: aggiorna ruolo/quotazione se il
   giocatore esiste già, altrimenti lo crea.

Analogamente i **voti ufficiali** dei giornalisti (Gazzetta, Fantacalcio.it) dopo ogni
giornata sono un prodotto a pagamento e non vengono usati: il punteggio in questa app è
calcolato "ad eventi" (vedi sotto).

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

## Setup

Requisiti: Node.js 20+.

```bash
# Dalla radice del repo
npm install

# Backend: configura l'ambiente
cd backend
cp .env.example .env
# (opzionale) apri .env e incolla FOOTBALL_DATA_API_KEY se ne hai una

# Crea il database SQLite e le tabelle
npx prisma migrate dev

# Popola i 472 giocatori Serie A 2025/26
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
  routes/                auth, leghe, squadre, giocatori, giornate, formazioni, live
  services/
    footballData.ts      client API football-data.org
    demoData.ts           generatore di partite finte (modalità demo)
    scoring.ts            calcolo fantavoti, punteggio formazioni, scontri diretti
    calendario.ts          generazione calendario round robin
    cronJob.ts             sync periodica della giornata corrente
  seed/                    dataset giocatori + script di seed
  prisma/schema.prisma      modello dati (SQLite)
```

## Struttura del frontend

```
frontend/src/
  api/          client fetch + tipi condivisi con il backend
  context/      AuthContext (sessione utente, JWT in localStorage)
  pages/        Login, Register, Dashboard, Lega, Squadra, Giocatori (live), Formazione
  components/   Layout (nav bar), ProtectedRoute
```

## Limiti noti e possibili estensioni future

- Il matching giocatore↔evento tra football-data.org e il nostro database è
  "best effort" per nome (normalizzazione + confronto cognome): con nomi ambigui può
  sbagliare. Un pannello admin per correggere manualmente gli abbinamenti sarebbe il
  prossimo passo naturale.
- Il calcolo del punteggio formazione non implementa ancora le sostituzioni automatiche
  dalla panchina in caso di titolare che non ha giocato, né il "modificatore di difesa"
  ufficiale del regolamento Fantacalcio.it.
- In produzione, per servire frontend e backend dallo stesso dominio conviene mettere
  un reverse proxy (nginx, Caddy) davanti a entrambi, oppure servire la build statica del
  frontend (`npm run build:frontend`) direttamente da Express.
- Il database è SQLite per semplicità (zero setup); per un uso con più utenti reali su
  internet conviene migrare a PostgreSQL cambiando solo `datasource` in
  `backend/prisma/schema.prisma` e la variabile `DATABASE_URL`.
