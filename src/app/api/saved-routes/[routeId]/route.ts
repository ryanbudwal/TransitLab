import { handleRequest } from "@/server/http/errors";
import {
  deleteSavedRoute,
  getSavedRoute,
} from "@/server/services/saved-route-service";

type Context = { params: Promise<{ routeId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleRequest(async () =>
    Response.json({
      data: await getSavedRoute((await context.params).routeId),
    }),
  );
}

export async function DELETE(_request: Request, context: Context) {
  return handleRequest(async () => {
    await deleteSavedRoute((await context.params).routeId);
    return new Response(null, { status: 204 });
  });
}
