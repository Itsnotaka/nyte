import type { QueueSyncRequest } from "@nyte/workflows";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";
import { NEEDS_YOU_QUERY_PARAMS } from "./query-params";

type SyncQuery = Pick<QueueSyncRequest, "cursor" | "watchKeywords">;

function parseRequiredQueryString(value: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

export function parseQueueSyncQueryParams(searchParams: URLSearchParams): SyncQuery {
  const cursor = parseRequiredQueryString(searchParams.get(NEEDS_YOU_QUERY_PARAMS.cursor));
  const watchKeywords = normalizeWatchKeywords(searchParams.getAll(NEEDS_YOU_QUERY_PARAMS.watch));

  return {
    cursor,
    watchKeywords: watchKeywords.length > 0 ? watchKeywords : undefined,
  };
}

export function buildQueueSyncQueryParams({
  cursor,
  watchKeywords = [],
}: SyncQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (cursor) {
    params.set(NEEDS_YOU_QUERY_PARAMS.cursor, cursor);
  }

  const normalizedWatchKeywords = normalizeWatchKeywords(watchKeywords);
  for (const keyword of normalizedWatchKeywords) {
    params.append(NEEDS_YOU_QUERY_PARAMS.watch, keyword);
  }

  return params;
}
