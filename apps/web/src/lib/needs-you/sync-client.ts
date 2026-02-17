import {
  isQueueSyncResponse,
  type QueueSyncRequest,
  type QueueSyncResponse,
} from "@nyte/workflows";
import { NEEDS_YOU_MESSAGES } from "./messages";
import {
  HTTP_METHODS,
  JSON_ACCEPT_HEADERS,
  readJsonSafe,
  resolveWorkflowApiError,
} from "./http-client";
import { NEEDS_YOU_API_ROUTES } from "./routes";
import { buildQueueSyncQueryParams } from "./sync-query";

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
    method: HTTP_METHODS.get,
    headers: JSON_ACCEPT_HEADERS,
    cache: "no-store",
  });

  return parseSyncPollResponse(response);
}
