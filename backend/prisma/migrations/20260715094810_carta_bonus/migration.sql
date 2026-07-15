-- CreateTable
CREATE TABLE "CartaBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadraId" TEXT NOT NULL,
    "giocatoreId" TEXT NOT NULL,
    "giornataAperturaId" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'PENDING',
    "giornataUtilizzoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartaBonus_squadraId_fkey" FOREIGN KEY ("squadraId") REFERENCES "Squadra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CartaBonus_giocatoreId_fkey" FOREIGN KEY ("giocatoreId") REFERENCES "Giocatore" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartaBonus_giornataAperturaId_fkey" FOREIGN KEY ("giornataAperturaId") REFERENCES "Giornata" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CartaBonus_giornataUtilizzoId_fkey" FOREIGN KEY ("giornataUtilizzoId") REFERENCES "Giornata" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CartaBonus_squadraId_giornataAperturaId_key" ON "CartaBonus"("squadraId", "giornataAperturaId");
