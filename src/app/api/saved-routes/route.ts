import { savedRouteInputSchema } from "@/shared/contracts";
import { handleRequest } from "@/server/http/errors";
import { paginationFrom, parseJson } from "@/server/http/parse";
import {
  createSavedRoute,
  listSavedRoutes,
} from "@/server/services/saved-route-service";

export async function GET(request: Request) {
  return handleRequest(async () => {
    const url = new URL(request.url);
    const networkId = url.searchParams.get("networkId");
    if (!networkId)
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "networkId is required.",
          },
        },
        { status: 422 },
      );
    const result = await listSavedRoutes({
      networkId,
      ...paginationFrom(url.searchParams),
    });
    return Response.json(result);
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const input = await parseJson(request, savedRouteInputSchema);
    return Response.json(
      { data: await createSavedRoute(input) },
      { status: 201 },
    );
  });
}
