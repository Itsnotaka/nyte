import {
  isQueueSyncResponse,
  isWorkflowApiErrorResponse,
  type QueueSyncRequest,
  type QueueSyncResponse,
} from "@nyte/workflows";
import { NEEDS_YOU_MESSAGES } from "./messages";
import { NEEDS_YOU_API_ROUTES } from "./routes";
import { buildQueueSyncQueryParams } from "./sync-query";

const JSON_ACCEPT_HEADERS = {
  accept: "application/json",
} as const;

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveWorkflowApiError(payload: unknown, fallback: string): string {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}

async function parseSyncPollResponse(response: Response): Promise<QueueSyncResponse> {
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(resolveWorkflowApiError(payload, NEEDS_YOU_MESSAGES.syncUnavailable));
  }

  if (!isQueueSyncResponse(payload)) {
    throw new Error(NEEDS_YOU_MESSAGES.invalidSyncResponse);
  }

  return payload;
}

type SyncNeedsYouInput = Pick<QueueSyncRequest, "cursor" | "watchKeywords">;

export async function syncNeedsYou({
  cursor,
  watchKeywords = [],
}: SyncNeedsYouInput): Promise<QueueSyncResponse> {
  const params = buildQueueSyncQueryParams({
    cursor,
    watchKeywords,
  });

  const url =
    params.size > 0
      ? `${NEEDS_YOU_API_ROUTES.sync}?${params.toString()}`
      : NEEDS_YOU_API_ROUTES.sync;

  const response = await fetch(url, {
    method: "GET",
    headers: JSON_ACCEPT_HEADERS,
    cache: "no-store",
  });

  return parseSyncPollResponse(response);
}
