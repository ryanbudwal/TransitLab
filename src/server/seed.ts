import type { Prisma } from "@prisma/client";
import alderCityJson from "../../prisma/seed-data/alder-city.json";
import {
  networkImportSchema,
  type NetworkImportInput,
} from "@/shared/contracts";

export const BUILT_IN_NETWORK_ID = "network:alder-city";

function safePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export async function createNetworkFromImport(
  tx: Prisma.TransactionClient,
  input: NetworkImportInput,
  options: { networkId: string; builtIn: boolean },
) {
  const { networkId, builtIn } = options;
  const stationIds = new Map(
    input.stations.map((station) => [
      station.code,
      `${networkId}:station:${safePart(station.code)}`,
    ]),
  );
  const lineIds = new Map(
    input.lines.map((line) => [
      line.code,
      `${networkId}:line:${safePart(line.code)}`,
    ]),
  );

  await tx.network.create({
    data: {
      id: networkId,
      slug: input.network.slug,
      name: input.network.name,
      description: input.network.description,
      schemaVersion: input.schemaVersion,
      transferPenaltyMinutes: input.network.transferPenaltyMinutes,
      isBuiltIn: builtIn,
    },
  });
  await tx.line.createMany({
    data: input.lines.map((line) => ({
      id: lineIds.get(line.code)!,
      networkId,
      ...line,
    })),
  });
  await tx.station.createMany({
    data: input.stations.map((station) => ({
      id: stationIds.get(station.code)!,
      networkId,
      ...station,
    })),
  });
  await tx.connection.createMany({
    data: input.connections.map((connection, index) => ({
      id: `${networkId}:connection:${String(index + 1).padStart(3, "0")}`,
      networkId,
      fromStationId: stationIds.get(connection.from)!,
      toStationId: stationIds.get(connection.to)!,
      lineId: lineIds.get(connection.line)!,
      travelMinutes: connection.travelMinutes,
      bidirectional: connection.bidirectional,
      accessible: connection.accessible,
    })),
  });
}

export async function seedBuiltInNetwork(tx: Prisma.TransactionClient) {
  const input = networkImportSchema.parse(alderCityJson);
  await tx.network.deleteMany({ where: { id: BUILT_IN_NETWORK_ID } });
  await createNetworkFromImport(tx, input, {
    networkId: BUILT_IN_NETWORK_ID,
    builtIn: true,
  });
  return BUILT_IN_NETWORK_ID;
}
