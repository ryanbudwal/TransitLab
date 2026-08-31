import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { SavedRouteDto } from "@/shared/api-types";
import type { SavedRouteInput } from "@/shared/contracts";
import { prisma } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import { calculateRouteFromInput } from "./route-service";

function toSavedRouteDto(route: {
  id: string;
  networkId: string;
  scenarioId: string | null;
  name: string;
  originStationId: string;
  destinationStationId: string;
  algorithm: string;
  preference: string;
  totalMinutes: number;
  stopCount: number;
  transferCount: number;
  nodesExplored: number;
  createdAt: Date;
}): SavedRouteDto {
  return {
    ...route,
    algorithm: route.algorithm as SavedRouteDto["algorithm"],
    preference: route.preference as SavedRouteDto["preference"],
    createdAt: route.createdAt.toISOString(),
  };
}

export async function createSavedRoute(
  input: SavedRouteInput,
  db: PrismaClient = prisma,
) {
  if (input.scenarioId) {
    const scenario = await db.scenario.findUnique({
      where: { id: input.scenarioId },
      select: { networkId: true },
    });
    if (!scenario || scenario.networkId !== input.networkId) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "The selected scenario does not belong to this network.",
      );
    }
  }
  const calculation = await calculateRouteFromInput(input, db);
  if (calculation.active.status !== "ok") {
    throw new AppError(422, "UNREACHABLE_ROUTE", calculation.active.message);
  }
  const result = calculation.active;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({ ...input, name: undefined, scenarioId: undefined }),
    )
    .digest("hex");
  const record = await db.savedRoute.create({
    data: {
      id: `route:${randomUUID()}`,
      networkId: input.networkId,
      scenarioId: input.scenarioId,
      name: input.name,
      originStationId: input.originStationId,
      destinationStationId: input.destinationStationId,
      algorithm: input.algorithm,
      preference: input.preference,
      totalMinutes: result.totalMinutes,
      stopCount: result.stopCount,
      transferCount: result.transferCount,
      nodesExplored: result.nodesExplored,
      resultJson: JSON.stringify(result),
      requestFingerprint: fingerprint,
      legs: {
        create: result.steps.map((step, position) => ({
          position,
          connectionId: step.connectionId,
          fromStationId: step.fromStationId,
          toStationId: step.toStationId,
          lineId: step.lineId,
          travelMinutes: step.travelMinutes,
          transferPenaltyMinutes: step.transferPenaltyMinutes,
          delayMinutes: step.delayMinutes,
          isTransfer: step.isTransfer,
        })),
      },
    },
  });
  return toSavedRouteDto(record);
}

export async function listSavedRoutes(
  options: { networkId: string; page: number; pageSize: number; skip: number },
  db: PrismaClient = prisma,
) {
  const where = { networkId: options.networkId };
  const [records, total] = await Promise.all([
    db.savedRoute.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: options.skip,
      take: options.pageSize,
    }),
    db.savedRoute.count({ where }),
  ]);
  return {
    data: records.map(toSavedRouteDto),
    meta: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    },
  };
}

export async function getSavedRoute(
  routeId: string,
  db: PrismaClient = prisma,
) {
  const route = await db.savedRoute.findUnique({
    where: { id: routeId },
    include: { legs: { orderBy: { position: "asc" } } },
  });
  if (!route) throw new AppError(404, "NOT_FOUND", "Saved route not found.");
  return {
    ...toSavedRouteDto(route),
    result: JSON.parse(route.resultJson) as unknown,
    legs: route.legs,
  };
}

export async function deleteSavedRoute(
  routeId: string,
  db: PrismaClient = prisma,
) {
  await db.savedRoute.delete({ where: { id: routeId } });
}
