# Pubblicare il sito online (gratis, senza scaricare nulla)

Questa guida ti porta da "codice su GitHub" a "un link che funziona da telefono
o computer", usando tre servizi gratuiti che non chiedono mai una carta di
credito:

- **Neon** — salva i dati (utenti, leghe, squadre, giocatori)
- **Render** — fa girare il "motore" del sito (il backend)
- **Vercel** — mostra le pagine che vedi nel browser (il frontend)

Tempo stimato: 15-20 minuti. Serve solo un browser e un'email per ogni
servizio (puoi anche registrarti con l'account GitHub, più veloce).

**Importante**: nella schermata di ogni servizio, quando ti viene chiesto
quale **branch** di GitHub usare, seleziona `claude/fantasy-football-live-app-gk85qy`
(non `main`): è il branch che contiene l'app.

---

## 1. Neon — il database (5 minuti)

1. Vai su [neon.tech](https://neon.tech) e registrati (gratis, es. con l'account GitHub).
2. Crea un nuovo progetto (basta dargli un nome, es. "fantacalcio").
3. Nella pagina del progetto trovi una casella **"Connection string"**. Se vedi
   un interruttore/toggle chiamato "Pooled connection", **disattivalo**
   (vogliamo la connessione diretta, più affidabile per questo tipo di app).
4. Copia la stringa: inizia con `postgresql://...` e finisce con
   `?sslmode=require`. Tienila da parte, ti servirà tra un minuto.

## 2. Render — il backend (7 minuti)

1. Vai su [render.com](https://render.com) e registrati (gratis, meglio con
   l'account GitHub così è già collegato).
2. Clicca **"New +"** in alto a destra → **"Blueprint"**.
3. Collega il tuo repository GitHub (la prima volta ti chiede il permesso di
   accedere ai tuoi repository: concedilo solo per questo repo se ti viene
   chiesto di scegliere).
4. Seleziona il repository del progetto e il branch
   `claude/fantasy-football-live-app-gk85qy`. Render troverà da solo il file
   `render.yaml` nella cartella principale e proporrà un servizio chiamato
   `fantacalcio-backend`.
5. Prima di confermare, ti verranno chieste alcune variabili:
   - **DATABASE_URL**: incolla la stringa copiata da Neon al punto 1.4
   - **JWT_SECRET**: lascialo vuoto, Render ne genera uno sicuro da solo
   - **CORS_ORIGIN**: per ora scrivi `http://localhost:5173` (lo aggiorneremo
     al punto 3.5, quando avremo l'indirizzo vero del sito)
   - **FOOTBALL_DATA_API_KEY**: lascialo vuoto per ora (l'app funziona lo
     stesso in modalità DEMO — vedi il README per aggiungerla in seguito)
6. Clicca **"Apply"** / **"Deploy"**. Il primo deploy impiega qualche minuto
   (installa le dipendenze, prepara il database, importa i 472 giocatori).
7. Quando lo stato diventa verde ("Live"), in alto trovi l'indirizzo del tuo
   backend, tipo `https://fantacalcio-backend-xxxx.onrender.com`. **Copialo**,
   ti serve subito dopo.

   Nota: il piano gratuito di Render "si addormenta" dopo 15 minuti senza
   richieste. La prima apertura dopo una pausa lunga può impiegare 30-50
   secondi a rispondere: è normale, non è rotto, aspetta e ricaricherà.

## 3. Vercel — il frontend, cioè il sito vero e proprio (5 minuti)

1. Vai su [vercel.com](https://vercel.com) e registrati (gratis, meglio con
   l'account GitHub).
2. Clicca **"Add New..."** → **"Project"**.
3. Importa lo stesso repository GitHub. Nella schermata di configurazione:
   - **Branch**: `claude/fantasy-football-live-app-gk85qy`
   - **Root Directory**: clicca "Edit" e scegli `frontend`
   - Vercel dovrebbe riconoscere automaticamente "Vite" come framework
   - Cerca l'opzione **"Include source files outside of the Root Directory in
     the Build Step"** (di solito sotto "Root Directory") e **attivala**:
     serve perché il progetto è organizzato in più cartelle
4. Prima di cliccare Deploy, apri la sezione **"Environment Variables"** e
   aggiungi:
   - Nome: `VITE_API_URL`
   - Valore: l'indirizzo del backend Render copiato al punto 2.7 (senza `/`
     finale), es. `https://fantacalcio-backend-xxxx.onrender.com`
5. Clicca **"Deploy"**. Dopo un minuto avrai il tuo link, tipo
   `https://tuo-progetto.vercel.app`. **Questo è il sito da condividere con
   gli amici.**

## 4. Ultimo passaggio: ricollegare backend e frontend

Il backend per ora accetta richieste solo da `http://localhost:5173` (l'avevi
messo temporaneamente al punto 2.5). Ora che hai l'indirizzo Vercel vero:

1. Torna su Render, apri il servizio `fantacalcio-backend`.
2. Vai su **"Environment"** nel menu laterale.
3. Modifica `CORS_ORIGIN` mettendo l'indirizzo Vercel del punto 3.5 (senza
   `/` finale), es. `https://tuo-progetto.vercel.app`.
4. Salva: Render fa da solo un piccolo redeploy (circa un minuto).

Fatto! Apri il link Vercel, registra un account e crea la tua prima lega.

---

## Aggiornare il sito dopo altre modifiche

Ogni volta che il codice sul branch `claude/fantasy-football-live-app-gk85qy`
viene aggiornato su GitHub, sia Render sia Vercel se ne accorgono da soli e
ripubblicano automaticamente la nuova versione: non devi rifare nessuno dei
passaggi sopra.

## Problemi comuni

- **La pagina resta su "Caricamento..." per sempre**: il backend Render si
  stava "svegliando" dopo un periodo di inattività. Aspetta 30-60 secondi e
  ricarica la pagina.
- **Errore di rete/CORS in console**: controlla che `CORS_ORIGIN` su Render
  corrisponda esattamente all'indirizzo Vercel (senza slash finale, con
  `https://`).
- **La lista giocatori è vuota**: apri i log del servizio su Render ("Logs" nel
  menu laterale) e controlla che il seed automatico sia partito senza errori
  al primo avvio.
