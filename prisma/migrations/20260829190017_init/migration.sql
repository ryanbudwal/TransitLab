-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "transferPenaltyMinutes" INTEGER NOT NULL DEFAULT 4,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Network_schemaVersion_check" CHECK ("schemaVersion" = 1),
    CONSTRAINT "Network_transferPenaltyMinutes_check" CHECK ("transferPenaltyMinutes" >= 0)
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "accessible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Station_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "Line_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "fromStationId" TEXT NOT NULL,
    "toStationId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "bidirectional" BOOLEAN NOT NULL DEFAULT true,
    "accessible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Connection_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_networkId_fromStationId_fkey" FOREIGN KEY ("networkId", "fromStationId") REFERENCES "Station" ("networkId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_networkId_toStationId_fkey" FOREIGN KEY ("networkId", "toStationId") REFERENCES "Station" ("networkId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_networkId_lineId_fkey" FOREIGN KEY ("networkId", "lineId") REFERENCES "Line" ("networkId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_travelMinutes_check" CHECK ("travelMinutes" > 0),
    CONSTRAINT "Connection_distinctStations_check" CHECK ("fromStationId" <> "toStationId")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "originStationId" TEXT NOT NULL,
    "destinationStationId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "transferPenaltyMinutes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scenario_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scenario_networkId_originStationId_fkey" FOREIGN KEY ("networkId", "originStationId") REFERENCES "Station" ("networkId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scenario_networkId_destinationStationId_fkey" FOREIGN KEY ("networkId", "destinationStationId") REFERENCES "Station" ("networkId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scenario_algorithm_check" CHECK ("algorithm" IN ('DIJKSTRA', 'ASTAR')),
    CONSTRAINT "Scenario_preference_check" CHECK ("preference" IN ('FASTEST', 'FEWEST_TRANSFERS', 'ACCESSIBLE')),
    CONSTRAINT "Scenario_transferPenaltyMinutes_check" CHECK ("transferPenaltyMinutes" >= 0),
    CONSTRAINT "Scenario_distinctStations_check" CHECK ("originStationId" <> "destinationStationId")
);

-- CreateTable
CREATE TABLE "ScenarioClosedStation" (
    "scenarioId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,

    PRIMARY KEY ("scenarioId", "stationId"),
    CONSTRAINT "ScenarioClosedStation_networkId_scenarioId_fkey" FOREIGN KEY ("networkId", "scenarioId") REFERENCES "Scenario" ("networkId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScenarioClosedStation_networkId_stationId_fkey" FOREIGN KEY ("networkId", "stationId") REFERENCES "Station" ("networkId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioLineDisruption" (
    "scenarioId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("scenarioId", "lineId"),
    CONSTRAINT "ScenarioLineDisruption_networkId_scenarioId_fkey" FOREIGN KEY ("networkId", "scenarioId") REFERENCES "Scenario" ("networkId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScenarioLineDisruption_networkId_lineId_fkey" FOREIGN KEY ("networkId", "lineId") REFERENCES "Line" ("networkId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScenarioLineDisruption_delayMinutes_check" CHECK ("delayMinutes" >= 0),
    CONSTRAINT "ScenarioLineDisruption_effect_check" CHECK ("suspended" = true OR "delayMinutes" > 0)
);

-- CreateTable
CREATE TABLE "SavedRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "name" TEXT NOT NULL,
    "originStationId" TEXT NOT NULL,
    "destinationStationId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "stopCount" INTEGER NOT NULL,
    "transferCount" INTEGER NOT NULL,
    "nodesExplored" INTEGER NOT NULL,
    "resultJson" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedRoute_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedRoute_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SavedRoute_originStationId_fkey" FOREIGN KEY ("originStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRoute_destinationStationId_fkey" FOREIGN KEY ("destinationStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRoute_algorithm_check" CHECK ("algorithm" IN ('DIJKSTRA', 'ASTAR')),
    CONSTRAINT "SavedRoute_preference_check" CHECK ("preference" IN ('FASTEST', 'FEWEST_TRANSFERS', 'ACCESSIBLE')),
    CONSTRAINT "SavedRoute_totals_check" CHECK ("totalMinutes" >= 0 AND "stopCount" >= 0 AND "transferCount" >= 0 AND "nodesExplored" >= 0),
    CONSTRAINT "SavedRoute_distinctStations_check" CHECK ("originStationId" <> "destinationStationId")
);

-- CreateTable
CREATE TABLE "SavedRouteLeg" (
    "savedRouteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "connectionId" TEXT NOT NULL,
    "fromStationId" TEXT NOT NULL,
    "toStationId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "transferPenaltyMinutes" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "isTransfer" BOOLEAN NOT NULL,

    PRIMARY KEY ("savedRouteId", "position"),
    CONSTRAINT "SavedRouteLeg_savedRouteId_fkey" FOREIGN KEY ("savedRouteId") REFERENCES "SavedRoute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedRouteLeg_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRouteLeg_fromStationId_fkey" FOREIGN KEY ("fromStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRouteLeg_toStationId_fkey" FOREIGN KEY ("toStationId") REFERENCES "Station" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRouteLeg_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedRouteLeg_values_check" CHECK ("position" >= 0 AND "travelMinutes" > 0 AND "transferPenaltyMinutes" >= 0 AND "delayMinutes" >= 0),
    CONSTRAINT "SavedRouteLeg_distinctStations_check" CHECK ("fromStationId" <> "toStationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Network_slug_key" ON "Network"("slug");

-- CreateIndex
CREATE INDEX "Network_name_idx" ON "Network"("name");

-- CreateIndex
CREATE INDEX "Station_networkId_name_idx" ON "Station"("networkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Station_networkId_id_key" ON "Station"("networkId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Station_networkId_code_key" ON "Station"("networkId", "code");

-- CreateIndex
CREATE INDEX "Line_networkId_idx" ON "Line"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "Line_networkId_id_key" ON "Line"("networkId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Line_networkId_code_key" ON "Line"("networkId", "code");

-- CreateIndex
CREATE INDEX "Connection_networkId_fromStationId_idx" ON "Connection"("networkId", "fromStationId");

-- CreateIndex
CREATE INDEX "Connection_networkId_toStationId_idx" ON "Connection"("networkId", "toStationId");

-- CreateIndex
CREATE INDEX "Connection_networkId_lineId_idx" ON "Connection"("networkId", "lineId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_networkId_fromStationId_toStationId_lineId_key" ON "Connection"("networkId", "fromStationId", "toStationId", "lineId");

-- CreateIndex
CREATE INDEX "Scenario_networkId_updatedAt_idx" ON "Scenario"("networkId", "updatedAt");

-- CreateIndex
CREATE INDEX "Scenario_networkId_name_idx" ON "Scenario"("networkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_networkId_id_key" ON "Scenario"("networkId", "id");

-- CreateIndex
CREATE INDEX "ScenarioClosedStation_networkId_stationId_idx" ON "ScenarioClosedStation"("networkId", "stationId");

-- CreateIndex
CREATE INDEX "ScenarioLineDisruption_networkId_lineId_idx" ON "ScenarioLineDisruption"("networkId", "lineId");

-- CreateIndex
CREATE INDEX "SavedRoute_networkId_createdAt_idx" ON "SavedRoute"("networkId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedRoute_scenarioId_idx" ON "SavedRoute"("scenarioId");

-- CreateIndex
CREATE INDEX "SavedRouteLeg_connectionId_idx" ON "SavedRouteLeg"("connectionId");
