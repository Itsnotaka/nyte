import { isQueueSyncResponse, type QueueSyncResponse } from "@nyte/workflows";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";
import {
  JSON_ACCEPT_HEADERS,
  readJsonSafe,
  resolveWorkflowApiError,
} from "./http-client";
import { NEEDS_YOU_API_ROUTES } from "./routes";

async function parseSyncPollResponse(response: Response): Promise<QueueSyncResponse> {
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    const fallback = "Unable to sync Gmail + Calendar right now.";
    throw new Error(resolveWorkflowApiError(payload, fallback));
  }

  if (!isQueueSyncResponse(payload)) {
    throw new Error("Sync payload is invalid.");
  }

  return {
    cursor: payload.cursor,
    needsYou: payload.needsYou,
  };
}

type SyncNeedsYouInput = {
  cursor: string | null;
  watchKeywords?: string[];
};

export async function syncNeedsYou({
  cursor,
  watchKeywords = [],
}: SyncNeedsYouInput): Promise<QueueSyncResponse> {
  const normalizedWatchKeywords = normalizeWatchKeywords(watchKeywords);
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  for (const keyword of normalizedWatchKeywords) {
    params.append("watch", keyword);
  }

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
