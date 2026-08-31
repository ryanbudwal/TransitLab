import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ScenarioDto } from "@/shared/api-types";
import {
  scenarioInputSchema,
  type ScenarioInput,
  type ScenarioPatch,
} from "@/shared/contracts";
import { prisma } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import { getNetwork } from "./network-service";
import { assertRouteReferences } from "./route-service";

const scenarioInclude = {
  closedStations: { orderBy: { stationId: "asc" as const } },
  lineDisruptions: { orderBy: { lineId: "asc" as const } },
};

type ScenarioRecord = Prisma.ScenarioGetPayload<{
  include: typeof scenarioInclude;
}>;

function toScenarioDto(scenario: ScenarioRecord): ScenarioDto {
  return {
    id: scenario.id,
    networkId: scenario.networkId,
    name: scenario.name,
    description: scenario.description,
    originStationId: scenario.originStationId,
    destinationStationId: scenario.destinationStationId,
    algorithm: scenario.algorithm as ScenarioDto["algorithm"],
    preference: scenario.preference as ScenarioDto["preference"],
    transferPenaltyMinutes: scenario.transferPenaltyMinutes,
    disruptions: {
      closedStationIds: scenario.closedStations.map((item) => item.stationId),
      suspendedLineIds: scenario.lineDisruptions
        .filter((item) => item.suspended)
        .map((item) => item.lineId),
      lineDelays: Object.fromEntries(
        scenario.lineDisruptions
          .filter((item) => item.delayMinutes > 0)
          .map((item) => [item.lineId, item.delayMinutes]),
      ),
    },
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString(),
  };
}

function lineDisruptionRows(input: ScenarioInput) {
  const lineIds = new Set([
    ...input.disruptions.suspendedLineIds,
    ...Object.keys(input.disruptions.lineDelays),
  ]);
  return [...lineIds].sort().map((lineId) => ({
    lineId,
    suspended: input.disruptions.suspendedLineIds.includes(lineId),
    delayMinutes: input.disruptions.lineDelays[lineId] ?? 0,
  }));
}

async function validateScenario(input: ScenarioInput, db: PrismaClient) {
  const network = await getNetwork(input.networkId, db);
  assertRouteReferences(input, network);
}

export async function createScenario(
  input: ScenarioInput,
  db: PrismaClient = prisma,
) {
  await validateScenario(input, db);
  const record = await db.scenario.create({
    data: {
      id: `scenario:${randomUUID()}`,
      networkId: input.networkId,
      name: input.name,
      description: input.description,
      originStationId: input.originStationId,
      destinationStationId: input.destinationStationId,
      algorithm: input.algorithm,
      preference: input.preference,
      transferPenaltyMinutes: input.transferPenaltyMinutes,
      closedStations: {
        create: input.disruptions.closedStationIds.map((stationId) => ({
          stationId,
        })),
      },
      lineDisruptions: { create: lineDisruptionRows(input) },
    },
    include: scenarioInclude,
  });
  return toScenarioDto(record);
}

export async function getScenario(
  scenarioId: string,
  db: PrismaClient = prisma,
) {
  const record = await db.scenario.findUnique({
    where: { id: scenarioId },
    include: scenarioInclude,
  });
  if (!record)
    throw new AppError(404, "NOT_FOUND", "Saved scenario not found.");
  return toScenarioDto(record);
}

export async function listScenarios(
  options: {
    networkId: string;
    query: string;
    page: number;
    pageSize: number;
    skip: number;
  },
  db: PrismaClient = prisma,
) {
  const where = {
    networkId: options.networkId,
    ...(options.query ? { name: { contains: options.query } } : {}),
  };
  const [records, total] = await Promise.all([
    db.scenario.findMany({
      where,
      include: scenarioInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: options.skip,
      take: options.pageSize,
    }),
    db.scenario.count({ where }),
  ]);
  return {
    data: records.map(toScenarioDto),
    meta: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    },
  };
}

export async function updateScenario(
  scenarioId: string,
  patch: ScenarioPatch,
  db: PrismaClient = prisma,
) {
  const current = await getScenario(scenarioId, db);
  const input = scenarioInputSchema.parse({
    networkId: current.networkId,
    name: patch.name ?? current.name,
    description: patch.description ?? current.description,
    originStationId: patch.originStationId ?? current.originStationId,
    destinationStationId:
      patch.destinationStationId ?? current.destinationStationId,
    algorithm: patch.algorithm ?? current.algorithm,
    preference: patch.preference ?? current.preference,
    transferPenaltyMinutes:
      patch.transferPenaltyMinutes ?? current.transferPenaltyMinutes,
    disruptions: patch.disruptions ?? current.disruptions,
  });
  await validateScenario(input, db);
  const record = await db.scenario.update({
    where: { id: scenarioId },
    data: {
      name: input.name,
      description: input.description,
      originStationId: input.originStationId,
      destinationStationId: input.destinationStationId,
      algorithm: input.algorithm,
      preference: input.preference,
      transferPenaltyMinutes: input.transferPenaltyMinutes,
      closedStations: {
        deleteMany: {},
        create: input.disruptions.closedStationIds.map((stationId) => ({
          stationId,
        })),
      },
      lineDisruptions: { deleteMany: {}, create: lineDisruptionRows(input) },
    },
    include: scenarioInclude,
  });
  return toScenarioDto(record);
}

export async function deleteScenario(
  scenarioId: string,
  db: PrismaClient = prisma,
) {
  await db.scenario.delete({ where: { id: scenarioId } });
}
