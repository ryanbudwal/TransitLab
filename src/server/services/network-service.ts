import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { NetworkDto } from "@/shared/api-types";
import type { NetworkImportInput } from "@/shared/contracts";
import { prisma } from "@/server/db/prisma";
import { AppError } from "@/server/http/errors";
import {
  findNetworkWithGraph,
  listNetworkRecords,
  type NetworkWithGraph,
} from "@/server/repositories/network-repository";
import { createNetworkFromImport, seedBuiltInNetwork } from "@/server/seed";

export function toNetworkDto(network: NetworkWithGraph): NetworkDto {
  return {
    id: network.id,
    slug: network.slug,
    name: network.name,
    description: network.description,
    schemaVersion: network.schemaVersion,
    transferPenaltyMinutes: network.transferPenaltyMinutes,
    isBuiltIn: network.isBuiltIn,
    createdAt: network.createdAt.toISOString(),
    updatedAt: network.updatedAt.toISOString(),
    stations: network.stations.map(({ id, code, name, x, y, accessible }) => ({
      id,
      code,
      name,
      x,
      y,
      accessible,
    })),
    lines: network.lines.map(({ id, code, name, color }) => ({
      id,
      code,
      name,
      color,
    })),
    connections: network.connections.map(
      ({
        id,
        fromStationId,
        toStationId,
        lineId,
        travelMinutes,
        bidirectional,
        accessible,
      }) => ({
        id,
        fromStationId,
        toStationId,
        lineId,
        travelMinutes,
        bidirectional,
        accessible,
      }),
    ),
  };
}

export async function getNetwork(networkId: string, db: PrismaClient = prisma) {
  const network = await findNetworkWithGraph(db, networkId);
  if (!network) throw new AppError(404, "NOT_FOUND", "Network not found.");
  return toNetworkDto(network);
}

export async function listNetworks(db: PrismaClient = prisma) {
  const records = await listNetworkRecords(db);
  return records.map((network) => ({
    id: network.id,
    slug: network.slug,
    name: network.name,
    description: network.description,
    isBuiltIn: network.isBuiltIn,
    updatedAt: network.updatedAt.toISOString(),
    counts: {
      stations: network._count.stations,
      lines: network._count.lines,
      connections: network._count.connections,
    },
  }));
}

export async function importNetwork(
  input: NetworkImportInput,
  db: PrismaClient = prisma,
) {
  const networkId = `network:${randomUUID()}`;
  await db.$transaction((tx) =>
    createNetworkFromImport(tx, input, { networkId, builtIn: false }),
  );
  return getNetwork(networkId, db);
}

export async function exportNetwork(
  networkId: string,
  db: PrismaClient = prisma,
): Promise<NetworkImportInput> {
  const network = await getNetwork(networkId, db);
  const stationCode = new Map(
    network.stations.map((station) => [station.id, station.code]),
  );
  const lineCode = new Map(network.lines.map((line) => [line.id, line.code]));
  return {
    schemaVersion: 1,
    network: {
      name: network.name,
      slug: network.slug,
      description: network.description,
      transferPenaltyMinutes: network.transferPenaltyMinutes,
    },
    lines: network.lines.map(({ code, name, color }) => ({
      code,
      name,
      color,
    })),
    stations: network.stations.map(({ code, name, x, y, accessible }) => ({
      code,
      name,
      x,
      y,
      accessible,
    })),
    connections: network.connections.map(
      ({
        fromStationId,
        toStationId,
        lineId,
        travelMinutes,
        bidirectional,
        accessible,
      }) => ({
        from: stationCode.get(fromStationId)!,
        to: stationCode.get(toStationId)!,
        line: lineCode.get(lineId)!,
        travelMinutes,
        bidirectional,
        accessible,
      }),
    ),
  };
}

export async function resetBuiltInNetwork(db: PrismaClient = prisma) {
  const networkId = await db.$transaction((tx) => seedBuiltInNetwork(tx));
  return getNetwork(networkId, db);
}
