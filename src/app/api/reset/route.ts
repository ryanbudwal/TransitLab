import { handleRequest } from "@/server/http/errors";
import { resetBuiltInNetwork } from "@/server/services/network-service";

export async function POST() {
  return handleRequest(async () =>
    Response.json({ data: await resetBuiltInNetwork() }),
  );
}
