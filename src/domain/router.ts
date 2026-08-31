import {
  buildGraph,
  DomainError,
  type DirectedEdge,
  type TransitGraph,
} from "./graph";
import { MinHeap } from "./priority-queue";
import type {
  RouteFailureReason,
  RouteRequest,
  RouteResult,
  RouteStep,
  RoutingPreference,
} from "./types";

interface SearchCost {
  minutes: number;
  transfers: number;
  stops: number;
}

interface QueueItem {
  stateKey: string;
  stationId: string;
  currentLineId: string | null;
  cost: SearchCost;
  heuristicMinutes: number;
  signature: string;
  ordinal: number;
}

interface PreviousStep {
  previousStateKey: string;
  edge: DirectedEdge;
  transferPenaltyMinutes: number;
  delayMinutes: number;
  isTransfer: boolean;
}

const stateKey = (stationId: string, lineId: string | null) =>
  `${stationId}\u0000${lineId ?? ""}`;

function compareNumbers(a: number, b: number) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCost(
  a: SearchCost,
  b: SearchCost,
  preference: RoutingPreference,
) {
  if (preference === "FEWEST_TRANSFERS") {
    return (
      compareNumbers(a.transfers, b.transfers) ||
      compareNumbers(a.minutes, b.minutes) ||
      compareNumbers(a.stops, b.stops)
    );
  }
  return (
    compareNumbers(a.minutes, b.minutes) ||
    compareNumbers(a.transfers, b.transfers) ||
    compareNumbers(a.stops, b.stops)
  );
}

function createQueueComparator(preference: RoutingPreference) {
  return (a: QueueItem, b: QueueItem) => {
    const estimateA = {
      ...a.cost,
      minutes: a.cost.minutes + a.heuristicMinutes,
    };
    const estimateB = {
      ...b.cost,
      minutes: b.cost.minutes + b.heuristicMinutes,
    };
    return (
      compareCost(estimateA, estimateB, preference) ||
      compareCost(a.cost, b.cost, preference) ||
      a.signature.localeCompare(b.signature) ||
      a.stateKey.localeCompare(b.stateKey) ||
      compareNumbers(a.ordinal, b.ordinal)
    );
  };
}

function failure(
  reason: RouteFailureReason,
  nodesExplored: number,
): RouteResult {
  const messages: Record<RouteFailureReason, string> = {
    ORIGIN_CLOSED: "The origin station is closed in this simulation.",
    DESTINATION_CLOSED: "The destination station is closed in this simulation.",
    ORIGIN_INACCESSIBLE: "The origin station is not wheelchair accessible.",
    DESTINATION_INACCESSIBLE:
      "The destination station is not wheelchair accessible.",
    NO_PATH:
      "No route satisfies the current disruptions and accessibility constraints.",
  };
  return {
    status: "unreachable",
    reason,
    nodesExplored,
    message: messages[reason],
  };
}

function isEdgeAvailable(
  edge: DirectedEdge,
  request: RouteRequest,
  graph: TransitGraph,
) {
  const { disruptions, preference } = request;
  if (disruptions.suspendedLineIds.includes(edge.lineId)) return false;
  if (
    disruptions.closedStationIds.includes(edge.fromStationId) ||
    disruptions.closedStationIds.includes(edge.toStationId)
  ) {
    return false;
  }
  if (preference === "ACCESSIBLE") {
    return Boolean(
      edge.accessible &&
      graph.stations.get(edge.fromStationId)?.accessible &&
      graph.stations.get(edge.toStationId)?.accessible,
    );
  }
  return true;
}

function createHeuristic(request: RouteRequest, graph: TransitGraph) {
  if (request.algorithm === "DIJKSTRA") return () => 0;
  let maxUnitsPerMinute = 0;
  for (const edge of graph.edges) {
    if (!isEdgeAvailable(edge, request, graph)) continue;
    const from = graph.stations.get(edge.fromStationId)!;
    const to = graph.stations.get(edge.toStationId)!;
    const geometricDistance = Math.hypot(from.x - to.x, from.y - to.y);
    maxUnitsPerMinute = Math.max(
      maxUnitsPerMinute,
      geometricDistance / edge.travelMinutes,
    );
  }
  const destination = graph.stations.get(request.destinationStationId)!;
  return (stationId: string) => {
    if (maxUnitsPerMinute === 0) return 0;
    const station = graph.stations.get(stationId)!;
    return (
      Math.hypot(station.x - destination.x, station.y - destination.y) /
      maxUnitsPerMinute
    );
  };
}

export function calculateRoute(request: RouteRequest): RouteResult {
  const graph = buildGraph(request.network);
  const origin = graph.stations.get(request.originStationId);
  const destination = graph.stations.get(request.destinationStationId);
  if (!origin)
    throw new DomainError(`Unknown origin station: ${request.originStationId}`);
  if (!destination)
    throw new DomainError(
      `Unknown destination station: ${request.destinationStationId}`,
    );
  const transferPenalty =
    request.transferPenaltyMinutes ?? request.network.transferPenaltyMinutes;
  if (!Number.isInteger(transferPenalty) || transferPenalty < 0) {
    throw new DomainError("Transfer penalty must be a non-negative integer.");
  }
  for (const delay of Object.values(request.disruptions.lineDelays)) {
    if (!Number.isInteger(delay) || delay < 0)
      throw new DomainError("Line delays must be non-negative integers.");
  }

  if (request.disruptions.closedStationIds.includes(origin.id))
    return failure("ORIGIN_CLOSED", 0);
  if (request.disruptions.closedStationIds.includes(destination.id))
    return failure("DESTINATION_CLOSED", 0);
  if (request.preference === "ACCESSIBLE" && !origin.accessible)
    return failure("ORIGIN_INACCESSIBLE", 0);
  if (request.preference === "ACCESSIBLE" && !destination.accessible)
    return failure("DESTINATION_INACCESSIBLE", 0);
  if (origin.id === destination.id) {
    return {
      status: "ok",
      algorithm: request.algorithm,
      preference: request.preference,
      originStationId: origin.id,
      destinationStationId: destination.id,
      stationSequence: [origin.id],
      steps: [],
      totalMinutes: 0,
      inVehicleMinutes: 0,
      transferPenaltyMinutes: 0,
      delayMinutes: 0,
      stopCount: 0,
      transferCount: 0,
      linesUsed: [],
      nodesExplored: 0,
      explanation: {
        objective: "Origin and destination are identical.",
        constraints: [],
        summary: "You are already at the selected destination.",
        heuristic:
          request.algorithm === "ASTAR"
            ? "No search was needed."
            : "Dijkstra uses no heuristic.",
      },
    };
  }

  const heuristic = createHeuristic(request, graph);
  const queue = new MinHeap<QueueItem>(
    createQueueComparator(request.preference),
  );
  const best = new Map<string, { cost: SearchCost; signature: string }>();
  const previous = new Map<string, PreviousStep>();
  const finalized = new Set<string>();
  const initialKey = stateKey(origin.id, null);
  const initialCost = { minutes: 0, transfers: 0, stops: 0 };
  let ordinal = 0;
  best.set(initialKey, { cost: initialCost, signature: "" });
  queue.push({
    stateKey: initialKey,
    stationId: origin.id,
    currentLineId: null,
    cost: initialCost,
    heuristicMinutes: heuristic(origin.id),
    signature: "",
    ordinal: ordinal++,
  });

  let goal: QueueItem | undefined;
  let nodesExplored = 0;
  while (queue.size > 0) {
    const current = queue.pop()!;
    const known = best.get(current.stateKey);
    if (
      !known ||
      compareCost(current.cost, known.cost, request.preference) !== 0 ||
      current.signature !== known.signature
    )
      continue;
    if (finalized.has(current.stateKey)) continue;
    finalized.add(current.stateKey);
    nodesExplored += 1;
    if (current.stationId === destination.id) {
      goal = current;
      break;
    }

    for (const edge of graph.adjacency.get(current.stationId) ?? []) {
      if (!isEdgeAvailable(edge, request, graph)) continue;
      const isTransfer =
        current.currentLineId !== null && current.currentLineId !== edge.lineId;
      const isBoarding =
        current.currentLineId === null || current.currentLineId !== edge.lineId;
      const transferMinutes = isTransfer ? transferPenalty : 0;
      const delayMinutes = isBoarding
        ? (request.disruptions.lineDelays[edge.lineId] ?? 0)
        : 0;
      const nextCost = {
        minutes:
          current.cost.minutes +
          edge.travelMinutes +
          transferMinutes +
          delayMinutes,
        transfers: current.cost.transfers + (isTransfer ? 1 : 0),
        stops: current.cost.stops + 1,
      };
      const nextStateKey = stateKey(edge.toStationId, edge.lineId);
      const nextSignature = current.signature
        ? `${current.signature}|${edge.directionId}`
        : edge.directionId;
      const existing = best.get(nextStateKey);
      const comparison = existing
        ? compareCost(nextCost, existing.cost, request.preference)
        : -1;
      if (
        existing &&
        (comparison > 0 ||
          (comparison === 0 && nextSignature >= existing.signature))
      )
        continue;
      best.set(nextStateKey, { cost: nextCost, signature: nextSignature });
      previous.set(nextStateKey, {
        previousStateKey: current.stateKey,
        edge,
        transferPenaltyMinutes: transferMinutes,
        delayMinutes,
        isTransfer,
      });
      queue.push({
        stateKey: nextStateKey,
        stationId: edge.toStationId,
        currentLineId: edge.lineId,
        cost: nextCost,
        heuristicMinutes: heuristic(edge.toStationId),
        signature: nextSignature,
        ordinal: ordinal++,
      });
    }
  }

  if (!goal) return failure("NO_PATH", nodesExplored);

  const reversed: PreviousStep[] = [];
  let cursor = goal.stateKey;
  while (cursor !== initialKey) {
    const entry = previous.get(cursor);
    if (!entry) throw new DomainError("Route reconstruction failed.");
    reversed.push(entry);
    cursor = entry.previousStateKey;
  }
  reversed.reverse();
  let cumulativeMinutes = 0;
  const steps: RouteStep[] = reversed.map(
    ({ edge, transferPenaltyMinutes, delayMinutes, isTransfer }) => {
      cumulativeMinutes +=
        edge.travelMinutes + transferPenaltyMinutes + delayMinutes;
      return {
        connectionId: edge.id,
        directionId: edge.directionId,
        fromStationId: edge.fromStationId,
        toStationId: edge.toStationId,
        lineId: edge.lineId,
        travelMinutes: edge.travelMinutes,
        transferPenaltyMinutes,
        delayMinutes,
        isTransfer,
        cumulativeMinutes,
      };
    },
  );
  const stationSequence = [origin.id, ...steps.map((step) => step.toStationId)];
  const linesUsed = steps.reduce<string[]>((lines, step) => {
    if (lines.at(-1) !== step.lineId) lines.push(step.lineId);
    return lines;
  }, []);
  const constraints = [
    request.disruptions.closedStationIds.length
      ? `${request.disruptions.closedStationIds.length} closed station(s)`
      : "",
    request.disruptions.suspendedLineIds.length
      ? `${request.disruptions.suspendedLineIds.length} suspended line(s)`
      : "",
    Object.keys(request.disruptions.lineDelays).length
      ? `${Object.keys(request.disruptions.lineDelays).length} line delay(s)`
      : "",
    request.preference === "ACCESSIBLE"
      ? "wheelchair-accessible stations and links only"
      : "",
  ].filter(Boolean);
  const objectives = {
    FASTEST:
      "Lowest total journey time, including boarding delays and transfer penalties.",
    FEWEST_TRANSFERS:
      "Fewest line changes first, with total journey time as the tie-breaker.",
    ACCESSIBLE:
      "Lowest total journey time using only wheelchair-accessible stations and links.",
  };

  return {
    status: "ok",
    algorithm: request.algorithm,
    preference: request.preference,
    originStationId: origin.id,
    destinationStationId: destination.id,
    stationSequence,
    steps,
    totalMinutes: goal.cost.minutes,
    inVehicleMinutes: steps.reduce((sum, step) => sum + step.travelMinutes, 0),
    transferPenaltyMinutes: steps.reduce(
      (sum, step) => sum + step.transferPenaltyMinutes,
      0,
    ),
    delayMinutes: steps.reduce((sum, step) => sum + step.delayMinutes, 0),
    stopCount: goal.cost.stops,
    transferCount: goal.cost.transfers,
    linesUsed,
    nodesExplored,
    explanation: {
      objective: objectives[request.preference],
      constraints,
      summary: `${request.algorithm === "ASTAR" ? "A*" : "Dijkstra"} explored ${nodesExplored} state${nodesExplored === 1 ? "" : "s"} and selected a ${goal.cost.minutes}-minute route with ${goal.cost.transfers} transfer${goal.cost.transfers === 1 ? "" : "s"}.`,
      heuristic:
        request.algorithm === "ASTAR"
          ? "Straight-line distance divided by the fastest observed network speed; delays and transfers are ignored, so the estimate never overstates remaining cost."
          : "Dijkstra expands states from lowest known cost and uses no heuristic estimate.",
    },
  };
}
