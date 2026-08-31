import { scenarioPatchSchema } from "@/shared/contracts";
import { handleRequest } from "@/server/http/errors";
import { parseJson } from "@/server/http/parse";
import {
  deleteScenario,
  getScenario,
  updateScenario,
} from "@/server/services/scenario-service";

type Context = { params: Promise<{ scenarioId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleRequest(async () =>
    Response.json({
      data: await getScenario((await context.params).scenarioId),
    }),
  );
}

export async function PATCH(request: Request, context: Context) {
  return handleRequest(async () => {
    const input = await parseJson(request, scenarioPatchSchema);
    return Response.json({
      data: await updateScenario((await context.params).scenarioId, input),
    });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleRequest(async () => {
    await deleteScenario((await context.params).scenarioId);
    return new Response(null, { status: 204 });
  });
}
