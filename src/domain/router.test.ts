import { describe, expect, it } from "vitest";
import {
  buildGraph,
  calculateRoute,
  compareRoutes,
  DomainError,
} from "@/domain";
import type { RouteDisruptions, RouteRequest, TransitNetwork } from "@/domain";

const noDisruptions: RouteDisruptions = {
  closedStationIds: [],
  suspendedLineIds: [],
  lineDelays: {},
};

function fixture(): TransitNetwork {
  return {
    id: "fixture",
    slug: "fixture",
    name: "Fixture",
    description: "Routing test fixture",
    transferPenaltyMinutes: 4,
    stations: [
      { id: "a", code: "A", name: "A", x: 0, y: 0, accessible: true },
      { id: "b", code: "B", name: "B", x: 2, y: 0, accessible: true },
      { id: "c", code: "C", name: "C", x: 4, y: 0, accessible: true },
      { id: "d", code: "D", name: "D", x: 6, y: 0, accessible: true },
      { id: "x", code: "X", name: "X", x: 3, y: 2, accessible: false },
    ],
    lines: [
      { id: "red", code: "R", name: "Red", color: "#ff0000" },
      { id: "blue", code: "B", name: "Blue", color: "#0000ff" },
    ],
    connections: [
      {
        id: "ab",
        fromStationId: "a",
        toStationId: "b",
        lineId: "red",
        travelMinutes: 3,
        bidirectional: true,
        accessible: true,
      },
      {
        id: "bc",
        fromStationId: "b",
        toStationId: "c",
        lineId: "blue",
        travelMinutes: 2,
        bidirectional: true,
        accessible: true,
      },
      {
        id: "cd",
        fromStationId: "c",
        toStationId: "d",
        lineId: "blue",
        travelMinutes: 3,
        bidirectional: true,
        accessible: true,
      },
      {
        id: "ad",
        fromStationId: "a",
        toStationId: "d",
        lineId: "red",
        travelMinutes: 13,
        bidirectional: true,
        accessible: true,
      },
      {
        id: "ax",
        fromStationId: "a",
        toStationId: "x",
        lineId: "red",
        travelMinutes: 20,
        bidirectional: true,
        accessible: false,
      },
      {
        id: "xd",
        fromStationId: "x",
        toStationId: "d",
        lineId: "red",
        travelMinutes: 20,
        bidirectional: true,
        accessible: false,
      },
    ],
  };
}

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    network: fixture(),
    originStationId: "a",
    destinationStationId: "d",
    algorithm: "DIJKSTRA",
    preference: "FASTEST",
    disruptions: noDisruptions,
    ...overrides,
  };
}

describe("graph construction", () => {
  it("expands bidirectional connections and sorts adjacency deterministically", () => {
    const graph = buildGraph(fixture());
    expect(graph.edges).toHaveLength(12);
    const directionIds =
      graph.adjacency.get("a")?.map((edge) => edge.directionId) ?? [];
    expect(directionIds).toEqual([...directionIds].sort());
  });

  it("rejects dangling references", () => {
    const network = fixture();
    network.connections.push({
      ...network.connections[0],
      id: "bad",
      toStationId: "missing",
    });
    expect(() => buildGraph(network)).toThrow(DomainError);
  });
});

describe("routing algorithms", () => {
  it("finds the known fastest route in a cyclic graph", () => {
    const result = calculateRoute(request());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.stationSequence).toEqual(["a", "b", "c", "d"]);
      expect(result.totalMinutes).toBe(12);
      expect(result.transferCount).toBe(1);
    }
  });

  it("returns the same optimum for Dijkstra and A*", () => {
    const dijkstra = calculateRoute(request({ algorithm: "DIJKSTRA" }));
    const astar = calculateRoute(request({ algorithm: "ASTAR" }));
    expect(astar.status).toBe("ok");
    expect(dijkstra.status).toBe("ok");
    if (astar.status === "ok" && dijkstra.status === "ok") {
      expect(astar.totalMinutes).toBe(dijkstra.totalMinutes);
      expect(astar.stationSequence).toEqual(dijkstra.stationSequence);
      expect(astar.nodesExplored).toBeLessThanOrEqual(dijkstra.nodesExplored);
    }
  });

  it("fewest-transfers chooses a slower single-line route", () => {
    const result = calculateRoute(request({ preference: "FEWEST_TRANSFERS" }));
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.stationSequence).toEqual(["a", "d"]);
      expect(result.transferCount).toBe(0);
      expect(result.totalMinutes).toBe(13);
    }
  });

  it("accessible routing rejects an inaccessible shortcut", () => {
    const network = fixture();
    network.connections.find(
      (connection) => connection.id === "ax",
    )!.travelMinutes = 2;
    network.connections.find(
      (connection) => connection.id === "xd",
    )!.travelMinutes = 2;
    const ordinary = calculateRoute(request({ network }));
    const accessible = calculateRoute(
      request({ network, preference: "ACCESSIBLE" }),
    );
    expect(ordinary.status).toBe("ok");
    expect(accessible.status).toBe("ok");
    if (ordinary.status === "ok" && accessible.status === "ok") {
      expect(ordinary.stationSequence).toContain("x");
      expect(accessible.stationSequence).not.toContain("x");
    }
  });

  it("applies a line delay once per boarding", () => {
    const result = calculateRoute(
      request({
        disruptions: { ...noDisruptions, lineDelays: { red: 5, blue: 2 } },
      }),
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.delayMinutes).toBeGreaterThan(0);
      expect(result.steps.filter((step) => step.delayMinutes > 0)).toHaveLength(
        result.linesUsed.length,
      );
    }
  });

  it("reroutes around a closed station", () => {
    const result = calculateRoute(
      request({ disruptions: { ...noDisruptions, closedStationIds: ["b"] } }),
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.stationSequence).toEqual(["a", "d"]);
      expect(result.totalMinutes).toBe(13);
    }
  });

  it("returns typed failures for suspended routes and inaccessible endpoints", () => {
    const suspended = calculateRoute(
      request({
        disruptions: { ...noDisruptions, suspendedLineIds: ["red", "blue"] },
      }),
    );
    expect(suspended).toMatchObject({
      status: "unreachable",
      reason: "NO_PATH",
    });
    const inaccessible = calculateRoute(
      request({ originStationId: "x", preference: "ACCESSIBLE" }),
    );
    expect(inaccessible).toMatchObject({
      status: "unreachable",
      reason: "ORIGIN_INACCESSIBLE",
    });
  });

  it("handles identical endpoints without exploring the graph", () => {
    const result = calculateRoute(request({ destinationStationId: "a" }));
    expect(result).toMatchObject({
      status: "ok",
      totalMinutes: 0,
      stopCount: 0,
      nodesExplored: 0,
    });
  });

  it("compares baseline and disrupted routes", () => {
    const baseline = calculateRoute(request());
    const active = calculateRoute(
      request({ disruptions: { ...noDisruptions, closedStationIds: ["b"] } }),
    );
    expect(compareRoutes(baseline, active)).toMatchObject({
      routeChanged: true,
      addedMinutes: 1,
    });
  });

  it("uses stable tie-breaking across repeated runs", () => {
    const signatures = Array.from({ length: 5 }, () =>
      calculateRoute(request({ algorithm: "ASTAR" })),
    ).map((result) =>
      result.status === "ok"
        ? result.steps.map((step) => step.directionId).join("|")
        : "failure",
    );
    expect(new Set(signatures).size).toBe(1);
  });
});
