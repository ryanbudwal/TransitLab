import type { z } from "zod";
import { AppError } from "./errors";

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(
      400,
      "MALFORMED_JSON",
      "Request body must contain valid JSON.",
    );
  }
  return schema.parse(body);
}

export function paginationFrom(searchParams: URLSearchParams) {
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "8", 10) || 8),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
