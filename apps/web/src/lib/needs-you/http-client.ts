import type { WorkflowApiErrorResponse } from "@nyte/workflows";
import { asRecord } from "~/lib/shared/value-guards";

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
  const record = asRecord(payload);
  if (!record) {
    return false;
  }

  const error = record.error;
  return typeof error === "string" && error.trim().length > 0;
}

export function resolveWorkflowApiError(payload: unknown, fallback: string): string {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}
