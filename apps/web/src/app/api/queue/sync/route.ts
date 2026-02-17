import { runIngestSignalsTask } from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";
import { parseQueueSyncQueryParams } from "~/lib/needs-you/sync-query";
import { NEEDS_YOU_ROUTE_CONFIG, type HttpStatusCode } from "~/lib/server/needs-you-route-config";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveAuthenticatedRequestSession } from "~/lib/server/request-session";
import { parseBodyWithRequiredStringField } from "~/lib/server/request-validation";
import {
  resolveWorkflowErrorTaskId,
  resolveWorkflowRouteError,
  toWorkflowApiErrorJsonResponse,
  toWorkflowRouteErrorJsonResponse,
} from "~/lib/server/workflow-route-error";

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
    const sessionResolution = await resolveAuthenticatedRequestSession({
      request,
      requestLog,
      unauthorizedEvent: config.events.unauthorized,
      unauthorizedMessage: config.messages.authRequired,
      unauthorizedStatus: config.statuses.unauthorized,
      route,
      method,
      taskId,
    });

    userId = sessionResolution.userId;
    if (sessionResolution.response) {
      status = sessionResolution.status;
      return sessionResolution.response;
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
      taskId: resolveWorkflowErrorTaskId(resolved, taskId),
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
