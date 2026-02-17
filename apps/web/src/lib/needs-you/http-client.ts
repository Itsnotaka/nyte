import { isWorkflowApiErrorResponse } from "@nyte/workflows";

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
