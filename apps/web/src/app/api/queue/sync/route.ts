import {
  WORKFLOW_TASK_IDS,
  runIngestSignalsTask,
  type QueueSyncRequest,
  type QueueSyncResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { REQUEST_EVENTS } from "~/lib/server/request-events";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveRequestSession } from "~/lib/server/request-session";
import {
  asObjectPayload,
  parseRequiredString,
  parseRequiredStringField,
} from "~/lib/server/request-validation";
import { normalizeWatchKeywords } from "~/lib/shared/watch-keywords";
import { resolveWorkflowRouteError } from "~/lib/server/workflow-route-error";

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
  const route = NEEDS_YOU_API_ROUTES.sync;
  const taskId = WORKFLOW_TASK_IDS.ingestSignals;
  const method = request.method;
  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const cursor = parseCursor(searchParams);
  const watchKeywords = parseWatchKeywords(searchParams);
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let userId: string | null = null;

  requestLog.info(REQUEST_EVENTS.queueSync.start, {
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
      status = 401;
      const response: WorkflowApiErrorResponse = {
        error: NEEDS_YOU_MESSAGES.queueAuthRequired,
      };
      requestLog.warn(REQUEST_EVENTS.queueSync.unauthorized, {
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
      status = 409;
      const response: WorkflowApiErrorResponse = {
        error: NEEDS_YOU_MESSAGES.queueTokenUnavailable,
      };
      requestLog.warn(REQUEST_EVENTS.queueSync.tokenMissing, {
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
    requestLog.info(REQUEST_EVENTS.queueSync.success, {
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
    const resolved = resolveWorkflowRouteError(error, NEEDS_YOU_MESSAGES.syncUnavailable);
    status = resolved.status;

    requestLog.error(REQUEST_EVENTS.queueSync.taskError, {
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
