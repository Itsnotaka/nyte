import { DismissError } from "@nyte/application/actions";
import {
  runDismissActionTask,
  type DismissActionRequest,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_ROUTE_CONFIG } from "~/lib/server/needs-you-route-config";
import { resolveRequestSession } from "~/lib/server/request-session";
import { type HttpStatusCode } from "~/lib/server/http-status";
import {
  parseBodyWithItemId,
  parseRequestPayload,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowErrorTaskId,
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorJsonResponse,
  toWorkflowRouteErrorJsonResponse,
} from "~/lib/server/workflow-route-error";

function parseDismissBody(value: unknown): DismissActionRequest | null {
  const parsed = parseBodyWithItemId(value);
  if (!parsed) {
    return null;
  }

  return {
    itemId: parsed.itemId,
  };
}

export async function POST(request: Request) {
  const config = NEEDS_YOU_ROUTE_CONFIG.actionDismiss;
  const route = config.route;
  const taskId = config.taskId;
  const method = config.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route, method);
  let status: HttpStatusCode = config.statuses.ok;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info(config.events.start, {
    route,
    method,
    taskId,
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
        taskId,
      });
      return toWorkflowApiErrorJsonResponse(config.messages.authRequired, status);
    }

    const payload = await parseRequestPayload(request, parseDismissBody);
    if (!payload) {
      status = config.statuses.invalidPayload;
      requestLog.warn(config.events.invalidPayload, {
        route,
        method,
        status,
        taskId,
      });
      return toWorkflowApiErrorJsonResponse(config.messages.invalidPayload, status);
    }
    itemId = payload.itemId;

    const result = await runDismissActionTask({
      itemId: payload.itemId,
    });
    requestLog.info(config.events.success, {
      route,
      method,
      status,
      itemId,
      userId,
      taskId,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof DismissError) {
      status = resolveWorkflowDomainStatus(error.code, config.statuses);
      requestLog.warn(config.events.domainError, {
        route,
        method,
        status,
        itemId,
        userId,
        taskId,
        message: error.message,
      });
      return toWorkflowApiErrorJsonResponse(error.message, status);
    }

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
      itemId,
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
      itemId,
      userId,
      taskId,
      durationMs: Date.now() - startedAt,
    });
  }
}
