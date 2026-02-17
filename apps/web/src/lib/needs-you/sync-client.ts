import type { QueueSyncResponse, WorkflowApiErrorResponse } from "@nyte/workflows";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";
import { asRecord } from "~/lib/shared/value-guards";
import { readJsonSafe, resolveWorkflowApiError } from "./http-client";
import { NEEDS_YOU_API_ROUTES } from "./routes";

async function parseSyncPollResponse(response: Response): Promise<QueueSyncResponse> {
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    const fallback = "Unable to sync Gmail + Calendar right now.";
    throw new Error(resolveWorkflowApiError(payload, fallback));
  }

  const record = asRecord(payload);
  if (!record) {
    throw new Error("Sync payload is invalid.");
  }

  const queuePayload = record as Partial<QueueSyncResponse> & Partial<WorkflowApiErrorResponse>;
  if (!Array.isArray(queuePayload.needsYou) || typeof queuePayload.cursor !== "string") {
    throw new Error("Sync payload is invalid.");
  }

  return {
    cursor: queuePayload.cursor,
    needsYou: queuePayload.needsYou,
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
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  return parseSyncPollResponse(response);
}
