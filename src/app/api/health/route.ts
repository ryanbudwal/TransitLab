import { prisma } from "@/server/db/prisma";
import { handleRequest } from "@/server/http/errors";

export async function GET() {
  return handleRequest(async () => {
    const networks = await prisma.network.count();
    return Response.json({
      data: { status: "ok", database: "connected", networks },
    });
  });
}
