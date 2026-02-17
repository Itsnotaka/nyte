import {
  runIngestSignalsTask,
  type QueueSyncRequest,
  type QueueSyncResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveRequestSession } from "~/lib/server/request-session";
import { resolveWorkflowRouteError } from "~/lib/server/workflow-route-error";

type AccessTokenPayload = {
  accessToken?: unknown;
};

function parseCursor(request: Request): QueueSyncRequest["cursor"] {
  const cursor = new URL(request.url).searchParams.get("cursor")?.trim();
  if (!cursor) {
    return undefined;
  }

  return cursor;
}

function parseWatchKeywords(request: Request): QueueSyncRequest["watchKeywords"] {
  const keywords = new URL(request.url).searchParams
    .getAll("watch")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length >= 3)
    .slice(0, 8);

  return keywords.length > 0 ? keywords : undefined;
}

function resolveAccessToken(payload: AccessTokenPayload) {
  if (typeof payload.accessToken !== "string") {
    return null;
  }

  const normalized = payload.accessToken.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export async function GET(request: Request) {
  const route = "/api/queue/sync";
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let userId: string | null = null;

  requestLog.info("queue.sync.start", {
    route,
    method: request.method,
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

    const accessTokenResult = (await auth.api.getAccessToken({
      headers: request.headers,
      body: {
        providerId: "google",
      },
    })) as AccessTokenPayload;

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

    const watchKeywords = parseWatchKeywords(request);
    const result = await runIngestSignalsTask({
      accessToken,
      cursor: parseCursor(request),
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
      message: watchKeywords ? `watch_keywords=${watchKeywords.length}` : undefined,
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
