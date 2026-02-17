import {
  runIngestSignalsTask,
  type QueueSyncRequest,
  type QueueSyncResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_ROUTE_CONFIG } from "~/lib/server/needs-you-route-config";
import { resolveRequestSession } from "~/lib/server/request-session";
import { type HttpStatusCode, HTTP_STATUS } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseRequiredString,
  parseRequiredStringField,
} from "~/lib/server/request-validation";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";
import {
  resolveWorkflowRouteError,
  toWorkflowApiErrorResponse,
} from "~/lib/server/workflow-route-error";

function parseCursor(searchParams: URLSearchParams): QueueSyncRequest["cursor"] {
  return parseRequiredString(searchParams.get("cursor")) ?? undefined;
}

function parseWatchKeywords(searchParams: URLSearchParams): QueueSyncRequest["watchKeywords"] {
  const keywords = normalizeWatchKeywords(searchParams.getAll("watch"));
  if (keywords.length === 0) {
    return undefined;
  }

  return keywords;
}

function resolveAccessToken(value: unknown) {
  const payload = asObjectPayload(value);
  if (!payload) {
    return null;
  }

  return parseRequiredStringField(payload, "accessToken");
}

export async function GET(request: Request) {
  const config = NEEDS_YOU_ROUTE_CONFIG.queueSync;
  const route = config.route;
  const taskId = config.taskId;
  const method = request.method;
  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const cursor = parseCursor(searchParams);
  const watchKeywords = parseWatchKeywords(searchParams);
  const requestLog = createApiRequestLogger(request, route);
  let status: HttpStatusCode = HTTP_STATUS.ok;
  let userId: string | null = null;

  requestLog.info(config.events.start, {
    route,
    method,
    taskId,
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
      status = config.statuses.unauthorized;
      const response = toWorkflowApiErrorResponse(config.messages.authRequired);
      requestLog.warn(config.events.unauthorized, {
        route,
        method,
        status,
        userId,
        taskId,
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
      status = config.statuses.tokenUnavailable;
      const response = toWorkflowApiErrorResponse(config.messages.tokenUnavailable);
      requestLog.warn(config.events.tokenMissing, {
        route,
        method,
        status,
        userId,
        taskId,
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
    requestLog.info(config.events.success, {
      route,
      method,
      status,
      userId,
      taskId,
      hasCursor: Boolean(cursor),
      watchKeywordCount: watchKeywords?.length ?? 0,
    });
    return Response.json(response);
  } catch (error) {
    const resolved = resolveWorkflowRouteError(error, config.messages.taskUnavailable);
    status = resolved.status;

    requestLog.error(config.events.taskError, {
      route,
      method,
      status,
      userId,
      taskId: resolved.logData.taskId ?? taskId,
      stage: resolved.logData.stage,
      errorTag: resolved.logData.errorTag,
      message: resolved.logData.message,
    });
    return Response.json(resolved.response, { status });
  } finally {
    requestLog.emit({
      route,
      method,
      status,
      userId,
      taskId,
      durationMs: Date.now() - startedAt,
    });
  }
}
