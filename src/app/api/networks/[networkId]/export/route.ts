import { handleRequest } from "@/server/http/errors";
import { exportNetwork } from "@/server/services/network-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ networkId: string }> },
) {
  return handleRequest(async () => {
    const { networkId } = await context.params;
    const data = await exportNetwork(networkId);
    return Response.json(
      { data },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${data.network.slug}.json"`,
        },
      },
    );
  });
}
