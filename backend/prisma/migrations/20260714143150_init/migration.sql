-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lega" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "codiceInvito" TEXT NOT NULL,
    "stagione" TEXT NOT NULL DEFAULT '2025/26',
    "budgetIniziale" INTEGER NOT NULL DEFAULT 500,
    "numeroGiornate" INTEGER NOT NULL DEFAULT 38,
    "adminId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lega_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Squadra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "legaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetResiduo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Squadra_legaId_fkey" FOREIGN KEY ("legaId") REFERENCES "Lega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Squadra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Giocatore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "squadraSerieA" TEXT NOT NULL,
    "ruolo" TEXT NOT NULL,
    "quotazione" INTEGER,
    "externalTeamId" INTEGER,
    "attivo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "RosaGiocatore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadraId" TEXT NOT NULL,
    "giocatoreId" TEXT NOT NULL,
    "prezzoPagato" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RosaGiocatore_squadraId_fkey" FOREIGN KEY ("squadraId") REFERENCES "Squadra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RosaGiocatore_giocatoreId_fkey" FOREIGN KEY ("giocatoreId") REFERENCES "Giocatore" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Giornata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "stagione" TEXT NOT NULL DEFAULT '2025/26',
    "stato" TEXT NOT NULL DEFAULT 'PROGRAMMATA',
    "dataInizio" DATETIME,
    "dataFine" DATETIME
);

-- CreateTable
CREATE TABLE "Partita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giornataId" TEXT NOT NULL,
    "externalId" INTEGER,
    "squadraCasa" TEXT NOT NULL,
    "squadraTrasf" TEXT NOT NULL,
    "golCasa" INTEGER,
    "golTrasf" INTEGER,
    "stato" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "dataOra" DATETIME,
    "aggiornatoAt" DATETIME NOT NULL,
    CONSTRAINT "Partita_giornataId_fkey" FOREIGN KEY ("giornataId") REFERENCES "Giornata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoPartita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partitaId" TEXT NOT NULL,
    "giocatoreId" TEXT,
    "tipo" TEXT NOT NULL,
    "minuto" INTEGER,
    "squadra" TEXT NOT NULL,
    CONSTRAINT "EventoPartita_partitaId_fkey" FOREIGN KEY ("partitaId") REFERENCES "Partita" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PunteggioGiocatore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "giornataId" TEXT NOT NULL,
    "giocatoreId" TEXT NOT NULL,
    "punti" REAL NOT NULL DEFAULT 6,
    "dettaglio" TEXT,
    "aggiornatoAt" DATETIME NOT NULL,
    CONSTRAINT "PunteggioGiocatore_giornataId_fkey" FOREIGN KEY ("giornataId") REFERENCES "Giornata" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PunteggioGiocatore_giocatoreId_fkey" FOREIGN KEY ("giocatoreId") REFERENCES "Giocatore" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Formazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadraId" TEXT NOT NULL,
    "giornataId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL DEFAULT '3-4-3',
    "punteggio" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formazione_squadraId_fkey" FOREIGN KEY ("squadraId") REFERENCES "Squadra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Formazione_giornataId_fkey" FOREIGN KEY ("giornataId") REFERENCES "Giornata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormazioneGiocatore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formazioneId" TEXT NOT NULL,
    "giocatoreId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FormazioneGiocatore_formazioneId_fkey" FOREIGN KEY ("formazioneId") REFERENCES "Formazione" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormazioneGiocatore_giocatoreId_fkey" FOREIGN KEY ("giocatoreId") REFERENCES "Giocatore" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scontro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legaId" TEXT NOT NULL,
    "giornataId" TEXT NOT NULL,
    "squadraCasaId" TEXT NOT NULL,
    "squadraTrasfId" TEXT NOT NULL,
    "punteggioCasa" REAL,
    "punteggioTrasf" REAL,
    CONSTRAINT "Scontro_legaId_fkey" FOREIGN KEY ("legaId") REFERENCES "Lega" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scontro_giornataId_fkey" FOREIGN KEY ("giornataId") REFERENCES "Giornata" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scontro_squadraCasaId_fkey" FOREIGN KEY ("squadraCasaId") REFERENCES "Squadra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scontro_squadraTrasfId_fkey" FOREIGN KEY ("squadraTrasfId") REFERENCES "Squadra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lega_codiceInvito_key" ON "Lega"("codiceInvito");

-- CreateIndex
CREATE UNIQUE INDEX "Squadra_legaId_userId_key" ON "Squadra"("legaId", "userId");

-- CreateIndex
CREATE INDEX "Giocatore_squadraSerieA_idx" ON "Giocatore"("squadraSerieA");

-- CreateIndex
CREATE INDEX "Giocatore_ruolo_idx" ON "Giocatore"("ruolo");

-- CreateIndex
CREATE UNIQUE INDEX "RosaGiocatore_squadraId_giocatoreId_key" ON "RosaGiocatore"("squadraId", "giocatoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Giornata_numero_stagione_key" ON "Giornata"("numero", "stagione");

-- CreateIndex
CREATE UNIQUE INDEX "Partita_externalId_key" ON "Partita"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PunteggioGiocatore_giornataId_giocatoreId_key" ON "PunteggioGiocatore"("giornataId", "giocatoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Formazione_squadraId_giornataId_key" ON "Formazione"("squadraId", "giornataId");

-- CreateIndex
CREATE UNIQUE INDEX "FormazioneGiocatore_formazioneId_giocatoreId_key" ON "FormazioneGiocatore"("formazioneId", "giocatoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Scontro_giornataId_squadraCasaId_squadraTrasfId_key" ON "Scontro"("giornataId", "squadraCasaId", "squadraTrasfId");
