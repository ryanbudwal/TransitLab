import type { PrismaClient } from "@prisma/client";
import { calculateRoute, compareRoutes } from "@/domain";
import type { RouteCalculationDto } from "@/shared/api-types";
import type { RouteRequestInput } from "@/shared/contracts";
import { prisma } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import { getNetwork } from "./network-service";

export function assertRouteReferences(
  input: RouteRequestInput,
  network: Awaited<ReturnType<typeof getNetwork>>,
) {
  const stationIds = new Set(network.stations.map((station) => station.id));
  const lineIds = new Set(network.lines.map((line) => line.id));
  const details: Array<{ path: string; message: string }> = [];
  if (!stationIds.has(input.originStationId))
    details.push({
      path: "originStationId",
      message: "Origin does not belong to this network.",
    });
  if (!stationIds.has(input.destinationStationId))
    details.push({
      path: "destinationStationId",
      message: "Destination does not belong to this network.",
    });
  input.disruptions.closedStationIds.forEach((stationId, index) => {
    if (!stationIds.has(stationId))
      details.push({
        path: `disruptions.closedStationIds.${index}`,
        message: "Closed station does not belong to this network.",
      });
  });
  input.disruptions.suspendedLineIds.forEach((lineId, index) => {
    if (!lineIds.has(lineId))
      details.push({
        path: `disruptions.suspendedLineIds.${index}`,
        message: "Suspended line does not belong to this network.",
      });
  });
  Object.keys(input.disruptions.lineDelays).forEach((lineId) => {
    if (!lineIds.has(lineId))
      details.push({
        path: `disruptions.lineDelays.${lineId}`,
        message: "Delayed line does not belong to this network.",
      });
  });
  if (details.length)
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "One or more route references are invalid.",
      details,
    );
}

export async function calculateRouteFromInput(
  input: RouteRequestInput,
  db: PrismaClient = prisma,
): Promise<RouteCalculationDto> {
  const network = await getNetwork(input.networkId, db);
  assertRouteReferences(input, network);
  const shared = {
    network,
    originStationId: input.originStationId,
    destinationStationId: input.destinationStationId,
    algorithm: input.algorithm,
    preference: input.preference,
    transferPenaltyMinutes: input.transferPenaltyMinutes,
  };
  const baseline = calculateRoute({
    ...shared,
    disruptions: { closedStationIds: [], suspendedLineIds: [], lineDelays: {} },
  });
  const active = calculateRoute({ ...shared, disruptions: input.disruptions });
  return { baseline, active, comparison: compareRoutes(baseline, active) };
}
