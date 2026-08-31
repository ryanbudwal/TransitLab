import { handleRequest } from "@/server/http/errors";
import { listNetworks } from "@/server/services/network-service";

export async function GET() {
  return handleRequest(async () =>
    Response.json({ data: await listNetworks() }),
  );
}
