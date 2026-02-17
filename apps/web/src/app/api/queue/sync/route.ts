import {
  runIngestSignalsTask,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { parseQueueSyncQueryParams } from "~/lib/needs-you/sync-query";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_ROUTE_CONFIG } from "~/lib/server/needs-you-route-config";
import { resolveRequestSession } from "~/lib/server/request-session";
import { type HttpStatusCode } from "~/lib/server/http-status";
import {
  parseBodyWithRequiredStringField,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowRouteError,
  toWorkflowApiErrorJsonResponse,
  toWorkflowRouteErrorJsonResponse,
} from "~/lib/server/workflow-route-error";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

function resolveAccessToken(value: unknown) {
  const parsed = parseBodyWithRequiredStringField(value, "accessToken");
  return parsed?.value ?? null;
}

export async function GET(request: Request) {
  const config = NEEDS_YOU_ROUTE_CONFIG.queueSync;
  const route = config.route;
  const taskId = config.taskId;
  const method = config.method;
  const startedAt = Date.now();
  const searchParams = new URL(request.url).searchParams;
  const { cursor, watchKeywords } = parseQueueSyncQueryParams(searchParams);
  const requestLog = createApiRequestLogger(request, route, method);
  let status: HttpStatusCode = config.statuses.ok;
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
      requestLog.warn(config.events.unauthorized, {
        route,
        method,
        status,
        userId,
        taskId,
      });
      return toWorkflowApiErrorJsonResponse(config.messages.authRequired, status);
    }

    const accessTokenResult = await auth.api.getAccessToken({
      headers: request.headers,
      body: {
        providerId: GOOGLE_AUTH_PROVIDER,
      },
    });

    const accessToken = resolveAccessToken(accessTokenResult);
    if (!accessToken) {
      status = config.statuses.tokenUnavailable;
      requestLog.warn(config.events.tokenMissing, {
        route,
        method,
        status,
        userId,
        taskId,
      });
      return toWorkflowApiErrorJsonResponse(config.messages.tokenUnavailable, status);
    }

    const result = await runIngestSignalsTask({
      accessToken,
      cursor,
      watchKeywords,
    });
    requestLog.info(config.events.success, {
      route,
      method,
      status,
      userId,
      taskId,
      hasCursor: Boolean(cursor),
      watchKeywordCount: watchKeywords?.length ?? 0,
    });
    return Response.json(result);
  } catch (error) {
    const resolved = resolveWorkflowRouteError(
      error,
      config.messages.taskUnavailable,
      config.statuses.taskFailure,
    );
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
    return toWorkflowRouteErrorJsonResponse(resolved);
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
