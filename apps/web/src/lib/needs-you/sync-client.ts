import type { WorkItemWithAction } from "@nyte/domain/actions";

export type SyncPollResponse = {
  cursor: string;
  needsYou: WorkItemWithAction[];
};

type SyncErrorPayload = {
  error?: unknown;
};

async function parseSyncPollResponse(response: Response): Promise<SyncPollResponse> {
  const payload = (await response.json()) as Partial<SyncPollResponse> & SyncErrorPayload;

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

export async function syncNeedsYou(cursor: string | null): Promise<SyncPollResponse> {
  const url = cursor ? `/api/queue/sync?cursor=${encodeURIComponent(cursor)}` : "/api/queue/sync";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  return parseSyncPollResponse(response);
}
