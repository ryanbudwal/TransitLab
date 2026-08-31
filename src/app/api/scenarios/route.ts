import { scenarioInputSchema } from "@/shared/contracts";
import { handleRequest } from "@/server/http/errors";
import { paginationFrom, parseJson } from "@/server/http/parse";
import {
  createScenario,
  listScenarios,
} from "@/server/services/scenario-service";

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
    const pagination = paginationFrom(url.searchParams);
    const result = await listScenarios({
      networkId,
      query: url.searchParams.get("query")?.trim() ?? "",
      ...pagination,
    });
    return Response.json(result);
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const input = await parseJson(request, scenarioInputSchema);
    return Response.json(
      { data: await createScenario(input) },
      { status: 201 },
    );
  });
}
