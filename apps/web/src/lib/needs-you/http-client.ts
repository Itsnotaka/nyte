import type { WorkflowApiErrorResponse } from "@nyte/workflows";

export async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function isWorkflowApiErrorResponse(
  payload: unknown,
): payload is WorkflowApiErrorResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim().length > 0;
}

export function resolveWorkflowApiError(payload: unknown, fallback: string): string {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}
