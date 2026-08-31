import { routeRequestSchema } from "@/shared/contracts";
import { handleRequest } from "@/server/http/errors";
import { parseJson } from "@/server/http/parse";
import { calculateRouteFromInput } from "@/server/services/route-service";

export async function POST(request: Request) {
  return handleRequest(async () => {
    const input = await parseJson(request, routeRequestSchema);
    return Response.json({ data: await calculateRouteFromInput(input) });
  });
}
