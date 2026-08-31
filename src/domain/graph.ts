import type { Connection, Station, TransitLine, TransitNetwork } from "./types";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export interface DirectedEdge extends Omit<Connection, "bidirectional"> {
  directionId: string;
}

export interface TransitGraph {
  stations: Map<string, Station>;
  lines: Map<string, TransitLine>;
  adjacency: Map<string, DirectedEdge[]>;
  edges: DirectedEdge[];
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value))
    throw new DomainError(`${label} must be finite.`);
}

export function buildGraph(network: TransitNetwork): TransitGraph {
  const stations = new Map<string, Station>();
  const lines = new Map<string, TransitLine>();
  const connectionIds = new Set<string>();

  for (const station of network.stations) {
    if (stations.has(station.id))
      throw new DomainError(`Duplicate station id: ${station.id}`);
    assertFinite(station.x, `Station ${station.id} x`);
    assertFinite(station.y, `Station ${station.id} y`);
    stations.set(station.id, station);
  }
  for (const line of network.lines) {
    if (lines.has(line.id))
      throw new DomainError(`Duplicate line id: ${line.id}`);
    lines.set(line.id, line);
  }

  const edges: DirectedEdge[] = [];
  for (const connection of network.connections) {
    if (connectionIds.has(connection.id))
      throw new DomainError(`Duplicate connection id: ${connection.id}`);
    connectionIds.add(connection.id);
    if (
      !stations.has(connection.fromStationId) ||
      !stations.has(connection.toStationId)
    ) {
      throw new DomainError(
        `Connection ${connection.id} references an unknown station.`,
      );
    }
    if (!lines.has(connection.lineId))
      throw new DomainError(
        `Connection ${connection.id} references an unknown line.`,
      );
    if (connection.fromStationId === connection.toStationId)
      throw new DomainError(`Connection ${connection.id} is a self-loop.`);
    if (
      !Number.isInteger(connection.travelMinutes) ||
      connection.travelMinutes <= 0
    ) {
      throw new DomainError(
        `Connection ${connection.id} travel time must be a positive integer.`,
      );
    }
    edges.push({ ...connection, directionId: `${connection.id}:forward` });
    if (connection.bidirectional) {
      edges.push({
        ...connection,
        directionId: `${connection.id}:reverse`,
        fromStationId: connection.toStationId,
        toStationId: connection.fromStationId,
      });
    }
  }

  const adjacency = new Map<string, DirectedEdge[]>();
  for (const stationId of stations.keys()) adjacency.set(stationId, []);
  for (const edge of edges) adjacency.get(edge.fromStationId)?.push(edge);
  for (const list of adjacency.values()) {
    list.sort(
      (a, b) =>
        a.lineId.localeCompare(b.lineId) ||
        a.toStationId.localeCompare(b.toStationId) ||
        a.directionId.localeCompare(b.directionId),
    );
  }
  return { stations, lines, adjacency, edges };
}
