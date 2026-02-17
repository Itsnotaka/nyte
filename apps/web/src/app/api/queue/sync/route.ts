import {
  runIngestSignalsTask,
  type QueueSyncRequest,
  type QueueSyncResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveRequestSession } from "~/lib/server/request-session";
import { asObjectPayload, parseRequiredString } from "~/lib/server/request-validation";
import { resolveWorkflowRouteError } from "~/lib/server/workflow-route-error";

function parseCursor(searchParams: URLSearchParams): QueueSyncRequest["cursor"] {
  const cursor = searchParams.get("cursor")?.trim();
  if (!cursor) {
    return undefined;
  }

  return cursor;
}

function parseWatchKeywords(searchParams: URLSearchParams): QueueSyncRequest["watchKeywords"] {
  const keywords = searchParams
    .getAll("watch")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length >= 3)
    .slice(0, 8);

  return keywords.length > 0 ? keywords : undefined;
}

function resolveAccessToken(value: unknown) {
  const payload = asObjectPayload(value);
  if (!payload) {
    return null;
  }

  return parseRequiredString(payload.accessToken);
}

export async function GET(request: Request) {
  const route = "/api/queue/sync";
  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const cursor = parseCursor(searchParams);
  const watchKeywords = parseWatchKeywords(searchParams);
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let userId: string | null = null;

  requestLog.info("queue.sync.start", {
    route,
    method: request.method,
    hasCursor: Boolean(cursor),
    watchKeywordCount: watchKeywords?.length ?? 0,
  });

  try {
    const { session, userId: sessionUserId } = await resolveRequestSession({
      request,
      requestLog,
    });
    userId = sessionUserId;
    if (!session) {
      status = 401;
      const response: WorkflowApiErrorResponse = {
        error: "Connect Google to load Gmail and Calendar signals.",
      };
      requestLog.warn("queue.sync.unauthorized", {
        route,
        method: request.method,
        status,
        userId,
      });
      return Response.json(response, { status });
    }

    const accessTokenResult = await auth.api.getAccessToken({
      headers: request.headers,
      body: {
        providerId: "google",
      },
    });

    const accessToken = resolveAccessToken(accessTokenResult);
    if (!accessToken) {
      status = 409;
      const response: WorkflowApiErrorResponse = {
        error:
          "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
      };
      requestLog.warn("queue.sync.token-missing", {
        route,
        method: request.method,
        status,
        userId,
      });
      return Response.json(response, { status });
    }

    const result = await runIngestSignalsTask({
      accessToken,
      cursor,
      watchKeywords,
    });

    const response: QueueSyncResponse = {
      cursor: result.cursor,
      needsYou: result.needsYou,
    };
    requestLog.info("queue.sync.success", {
      route,
      method: request.method,
      status,
      hasCursor: Boolean(cursor),
      watchKeywordCount: watchKeywords?.length ?? 0,
    });
    return Response.json(response);
  } catch (error) {
    const resolved = resolveWorkflowRouteError(error, "Unable to sync Gmail and Calendar signals.");
    status = resolved.status;

    requestLog.error(resolved.logData.message, {
      route,
      method: request.method,
      status,
      userId,
      taskId: resolved.logData.taskId,
      errorTag: resolved.logData.errorTag,
      message: resolved.logData.message,
    });
    return Response.json(resolved.response, { status });
  } finally {
    requestLog.emit({
      route,
      method: request.method,
      status,
      userId,
      durationMs: Date.now() - startedAt,
    });
  }
}
