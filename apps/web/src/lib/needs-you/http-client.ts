import { isWorkflowApiErrorResponse } from "@nyte/workflows";

export const JSON_ACCEPT_HEADERS = {
  accept: "application/json",
} as const;

export const JSON_REQUEST_HEADERS = {
  "content-type": "application/json",
  ...JSON_ACCEPT_HEADERS,
} as const;

export const HTTP_METHODS = {
  get: "GET",
  post: "POST",
} as const;

export async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function resolveWorkflowApiError(payload: unknown, fallback: string): string {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}
