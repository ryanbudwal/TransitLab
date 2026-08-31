import { PrismaClient } from "@prisma/client";
import { seedBuiltInNetwork } from "../src/server/seed";

const prisma = new PrismaClient();

async function main() {
  const networkId = await prisma.$transaction((tx) => seedBuiltInNetwork(tx));
  console.log(`Seeded deterministic network ${networkId}.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    throw error;
  });
