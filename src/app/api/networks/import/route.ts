import { networkImportSchema } from "@/shared/contracts";
import { handleRequest } from "@/server/http/errors";
import { parseJson } from "@/server/http/parse";
import { importNetwork } from "@/server/services/network-service";

export async function POST(request: Request) {
  return handleRequest(async () => {
    const input = await parseJson(request, networkImportSchema);
    return Response.json({ data: await importNetwork(input) }, { status: 201 });
  });
}
