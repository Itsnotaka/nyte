import type { QueueSyncRequest } from "@nyte/workflows";

import { parseRequiredStringValue } from "~/lib/shared/value-guards";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";

type SyncQuery = Pick<QueueSyncRequest, "cursor" | "watchKeywords">;
const NEEDS_YOU_QUERY_PARAMS = {
  cursor: "cursor",
  watch: "watch",
} as const;

export function parseQueueSyncQueryParams(
  searchParams: URLSearchParams
): SyncQuery {
  const cursor =
    parseRequiredStringValue(searchParams.get(NEEDS_YOU_QUERY_PARAMS.cursor)) ??
    undefined;
  const watchKeywords = normalizeWatchKeywords(
    searchParams.getAll(NEEDS_YOU_QUERY_PARAMS.watch)
  );

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
