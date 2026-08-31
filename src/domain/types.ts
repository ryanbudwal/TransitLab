export type RoutingAlgorithm = "DIJKSTRA" | "ASTAR";
export type RoutingPreference = "FASTEST" | "FEWEST_TRANSFERS" | "ACCESSIBLE";

export interface Station {
  id: string;
  code: string;
  name: string;
  x: number;
  y: number;
  accessible: boolean;
}

export interface TransitLine {
  id: string;
  code: string;
  name: string;
  color: string;
}

export interface Connection {
  id: string;
  fromStationId: string;
  toStationId: string;
  lineId: string;
  travelMinutes: number;
  bidirectional: boolean;
  accessible: boolean;
}

export interface TransitNetwork {
  id: string;
  slug: string;
  name: string;
  description: string;
  transferPenaltyMinutes: number;
  stations: Station[];
  lines: TransitLine[];
  connections: Connection[];
}

export interface RouteDisruptions {
  closedStationIds: string[];
  suspendedLineIds: string[];
  lineDelays: Record<string, number>;
}

export interface RouteRequest {
  network: TransitNetwork;
  originStationId: string;
  destinationStationId: string;
  algorithm: RoutingAlgorithm;
  preference: RoutingPreference;
  transferPenaltyMinutes?: number;
  disruptions: RouteDisruptions;
}

export interface RouteStep {
  connectionId: string;
  directionId: string;
  fromStationId: string;
  toStationId: string;
  lineId: string;
  travelMinutes: number;
  transferPenaltyMinutes: number;
  delayMinutes: number;
  isTransfer: boolean;
  cumulativeMinutes: number;
}

export interface RouteSuccess {
  status: "ok";
  algorithm: RoutingAlgorithm;
  preference: RoutingPreference;
  originStationId: string;
  destinationStationId: string;
  stationSequence: string[];
  steps: RouteStep[];
  totalMinutes: number;
  inVehicleMinutes: number;
  transferPenaltyMinutes: number;
  delayMinutes: number;
  stopCount: number;
  transferCount: number;
  linesUsed: string[];
  nodesExplored: number;
  explanation: {
    objective: string;
    constraints: string[];
    summary: string;
    heuristic: string;
  };
}

export type RouteFailureReason =
  | "ORIGIN_CLOSED"
  | "DESTINATION_CLOSED"
  | "ORIGIN_INACCESSIBLE"
  | "DESTINATION_INACCESSIBLE"
  | "NO_PATH";

export interface RouteFailure {
  status: "unreachable";
  reason: RouteFailureReason;
  nodesExplored: number;
  message: string;
}

export type RouteResult = RouteSuccess | RouteFailure;

export interface RouteComparison {
  addedMinutes: number;
  transferDelta: number;
  stopDelta: number;
  routeChanged: boolean;
}
