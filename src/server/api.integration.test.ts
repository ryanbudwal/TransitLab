import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as calculateRouteHandler } from "@/app/api/routes/calculate/route";
import {
  GET as listScenariosHandler,
  POST as createScenarioHandler,
} from "@/app/api/scenarios/route";
import {
  GET as listSavedRoutesHandler,
  POST as createSavedRouteHandler,
} from "@/app/api/saved-routes/route";
import { POST as resetHandler } from "@/app/api/reset/route";
import { prisma } from "@/server/db/prisma";
import { seedBuiltInNetwork } from "@/server/seed";

const networkId = "network:alder-city";
const station = (code: string) => `${networkId}:station:${code}`;
const line = (code: string) => `${networkId}:line:${code}`;

const routeBody = {
  networkId,
  originStationId: station("wpk"),
  destinationStationId: station("ntg"),
  algorithm: "ASTAR",
  preference: "FASTEST",
  transferPenaltyMinutes: 4,
  disruptions: { closedStationIds: [], suspendedLineIds: [], lineDelays: {} },
} as const;

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await prisma.$transaction((transaction) => seedBuiltInNetwork(transaction));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("route calculation API", () => {
  it("returns the same optimum for Dijkstra and A* through the HTTP boundary", async () => {
    const astarResponse = await calculateRouteHandler(
      jsonRequest("http://localhost/api/routes/calculate", routeBody),
    );
    const dijkstraResponse = await calculateRouteHandler(
      jsonRequest("http://localhost/api/routes/calculate", {
        ...routeBody,
        algorithm: "DIJKSTRA",
      }),
    );
    expect(astarResponse.status).toBe(200);
    expect(dijkstraResponse.status).toBe(200);
    const astar = await astarResponse.json();
    const dijkstra = await dijkstraResponse.json();
    expect(astar.data.active.status).toBe("ok");
    expect(astar.data.active.totalMinutes).toBe(
      dijkstra.data.active.totalMinutes,
    );
    expect(astar.data.active.stationSequence).toEqual(
      dijkstra.data.active.stationSequence,
    );
    expect(astar.data.active.nodesExplored).toBeGreaterThan(0);
  });

  it("reroutes around a persisted-network station closure", async () => {
    const response = await calculateRouteHandler(
      jsonRequest("http://localhost/api/routes/calculate", {
        ...routeBody,
        disruptions: {
          closedStationIds: [station("ctr")],
          suspendedLineIds: [],
          lineDelays: {},
        },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.active.status).toBe("ok");
    expect(body.data.active.stationSequence).not.toContain(station("ctr"));
    expect(body.data.active.stationSequence).toContain(station("std"));
    expect(body.data.comparison.routeChanged).toBe(true);
    expect(body.data.comparison.addedMinutes).toBeGreaterThan(0);
  });

  it("returns consistent validation errors without writing data", async () => {
    const negativeDelay = await calculateRouteHandler(
      jsonRequest("http://localhost/api/routes/calculate", {
        ...routeBody,
        disruptions: {
          closedStationIds: [],
          suspendedLineIds: [],
          lineDelays: { [line("c")]: -1 },
        },
      }),
    );
    expect(negativeDelay.status).toBe(422);
    expect(await negativeDelay.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });

    const malformed = await calculateRouteHandler(
      new Request("http://localhost/api/routes/calculate", {
        method: "POST",
        body: "{not-json",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      error: { code: "MALFORMED_JSON" },
    });
    expect(await prisma.scenario.count()).toBe(0);
  });
});

describe("scenario and saved-route persistence APIs", () => {
  it("persists, filters, and paginates a scenario in the isolated SQLite database", async () => {
    const createResponse = await createScenarioHandler(
      jsonRequest("http://localhost/api/scenarios", {
        ...routeBody,
        name: "Central closure drill",
        description: "Integration test scenario",
        disruptions: {
          closedStationIds: [station("ctr")],
          suspendedLineIds: [],
          lineDelays: { [line("v")]: 3 },
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()).data;

    const independentClient = new PrismaClient();
    const persisted = await independentClient.scenario.findUnique({
      where: { id: created.id },
      include: { closedStations: true, lineDisruptions: true },
    });
    await independentClient.$disconnect();
    expect(persisted?.name).toBe("Central closure drill");
    expect(persisted?.closedStations).toHaveLength(1);
    expect(persisted?.lineDisruptions).toHaveLength(1);

    const listResponse = await listScenariosHandler(
      new Request(
        `http://localhost/api/scenarios?networkId=${encodeURIComponent(networkId)}&query=Central&page=1&pageSize=1`,
      ),
    );
    const listed = await listResponse.json();
    expect(listed.data).toHaveLength(1);
    expect(listed.meta).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
  });

  it("recalculates and persists a saved-route snapshot server-side", async () => {
    const createResponse = await createSavedRouteHandler(
      jsonRequest("http://localhost/api/saved-routes", {
        ...routeBody,
        name: "Northgate commute",
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()).data;
    expect(created.totalMinutes).toBeGreaterThan(0);
    const persisted = await prisma.savedRoute.findUnique({
      where: { id: created.id },
      include: { legs: { orderBy: { position: "asc" } } },
    });
    expect(persisted?.legs.length).toBeGreaterThan(0);
    expect(JSON.parse(persisted!.resultJson).totalMinutes).toBe(
      created.totalMinutes,
    );

    const listResponse = await listSavedRoutesHandler(
      new Request(
        `http://localhost/api/saved-routes?networkId=${encodeURIComponent(networkId)}&page=1&pageSize=4`,
      ),
    );
    const listed = await listResponse.json();
    expect(listed.data[0]).toMatchObject({ name: "Northgate commute" });
  });
});

describe("reset and database integrity", () => {
  it("restores deterministic seed data and removes dependent built-in records", async () => {
    await createScenarioHandler(
      jsonRequest("http://localhost/api/scenarios", {
        ...routeBody,
        name: "Temporary scenario",
        description: "Removed by reset",
      }),
    );
    await prisma.network.update({
      where: { id: networkId },
      data: { name: "Changed name" },
    });

    const response = await resetHandler();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.name).toBe("Alder City Transit");
    expect(body.data.stations).toHaveLength(18);
    expect(body.data.connections).toHaveLength(20);
    expect(await prisma.scenario.count({ where: { networkId } })).toBe(0);
  });

  it("enforces migration-level checks and foreign keys", async () => {
    await expect(
      prisma.connection.create({
        data: {
          id: "invalid-zero-minute-connection",
          networkId,
          fromStationId: station("wpk"),
          toStationId: station("arc"),
          lineId: line("t"),
          travelMinutes: 0,
          bidirectional: true,
          accessible: true,
        },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.connection.findUnique({
        where: { id: "invalid-zero-minute-connection" },
      }),
    ).toBeNull();
  });
});
