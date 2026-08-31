import type { ApiErrorBody, ApiSuccess } from "@/shared/api-types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiEnvelope<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiSuccess<T>> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      body?.error.message ?? `Request failed with status ${response.status}.`,
      body?.error.code ?? "REQUEST_FAILED",
      body?.error.details ?? [],
    );
  }
  if (response.status === 204) return { data: undefined as T };
  return (await response.json()) as ApiSuccess<T>;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  return (await apiEnvelope<T>(url, init)).data;
}
