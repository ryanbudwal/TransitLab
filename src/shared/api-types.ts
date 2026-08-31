import type { RouteComparison, RouteResult, TransitNetwork } from "@/domain";

export interface ApiErrorBody {
  error: {
    code:
      | "MALFORMED_JSON"
      | "VALIDATION_ERROR"
      | "NOT_FOUND"
      | "CONFLICT"
      | "UNREACHABLE_ROUTE"
      | "DOMAIN_ERROR"
      | "INTERNAL_ERROR";
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export interface ApiSuccess<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface NetworkDto extends TransitNetwork {
  schemaVersion: number;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RouteCalculationDto {
  baseline: RouteResult;
  active: RouteResult;
  comparison: RouteComparison | null;
}

export interface ScenarioDto {
  id: string;
  networkId: string;
  name: string;
  description: string;
  originStationId: string;
  destinationStationId: string;
  algorithm: "DIJKSTRA" | "ASTAR";
  preference: "FASTEST" | "FEWEST_TRANSFERS" | "ACCESSIBLE";
  transferPenaltyMinutes: number;
  disruptions: {
    closedStationIds: string[];
    suspendedLineIds: string[];
    lineDelays: Record<string, number>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SavedRouteDto {
  id: string;
  networkId: string;
  scenarioId: string | null;
  name: string;
  originStationId: string;
  destinationStationId: string;
  algorithm: "DIJKSTRA" | "ASTAR";
  preference: "FASTEST" | "FEWEST_TRANSFERS" | "ACCESSIBLE";
  totalMinutes: number;
  stopCount: number;
  transferCount: number;
  nodesExplored: number;
  createdAt: string;
}
