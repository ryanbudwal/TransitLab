import { handleRequest } from "@/server/http/errors";
import { getNetwork } from "@/server/services/network-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ networkId: string }> },
) {
  return handleRequest(async () => {
    const { networkId } = await context.params;
    return Response.json({ data: await getNetwork(networkId) });
  });
}
