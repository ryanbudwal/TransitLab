import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { DomainError } from "@/domain";
import type { ApiErrorBody } from "@/shared/api-types";

export type ErrorCode = ApiErrorBody["error"]["code"];

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      } satisfies ApiErrorBody,
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request did not pass validation.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      } satisfies ApiErrorBody,
      { status: 422 },
    );
  }
  if (error instanceof DomainError) {
    return Response.json(
      {
        error: { code: "DOMAIN_ERROR", message: error.message },
      } satisfies ApiErrorBody,
      { status: 422 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return Response.json(
        {
          error: {
            code: "CONFLICT",
            message: "A record with that unique value already exists.",
          },
        } satisfies ApiErrorBody,
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "The requested record was not found.",
          },
        } satisfies ApiErrorBody,
        { status: 404 },
      );
    }
  }
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
    } satisfies ApiErrorBody,
    { status: 500 },
  );
}

export async function handleRequest(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    return toErrorResponse(error);
  }
}
