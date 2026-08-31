import type { Prisma, PrismaClient } from "@prisma/client";

export type NetworkWithGraph = Prisma.NetworkGetPayload<{
  include: { stations: true; lines: true; connections: true };
}>;

export const graphInclude = {
  stations: { orderBy: { code: "asc" as const } },
  lines: { orderBy: { code: "asc" as const } },
  connections: { orderBy: { id: "asc" as const } },
};

export function findNetworkWithGraph(db: PrismaClient, id: string) {
  return db.network.findUnique({ where: { id }, include: graphInclude });
}

export function listNetworkRecords(db: PrismaClient) {
  return db.network.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { stations: true, lines: true, connections: true } },
    },
  });
}
