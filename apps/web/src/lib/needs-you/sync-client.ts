import type { QueueSyncResponse, WorkflowApiErrorResponse } from "@nyte/workflows";

async function parseSyncPollResponse(response: Response): Promise<QueueSyncResponse> {
  const payload = (await response.json()) as Partial<QueueSyncResponse> &
    Partial<WorkflowApiErrorResponse>;

  if (!response.ok) {
    const fallback = "Unable to sync Gmail + Calendar right now.";
    const message =
      typeof payload.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : fallback;
    throw new Error(message);
  }

  if (!Array.isArray(payload.needsYou) || typeof payload.cursor !== "string") {
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
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  for (const keyword of watchKeywords) {
    params.append("watch", keyword);
  }

  const url = params.size > 0 ? `/api/queue/sync?${params.toString()}` : "/api/queue/sync";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  return parseSyncPollResponse(response);
}
