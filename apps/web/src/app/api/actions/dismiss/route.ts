import { DismissError } from "@nyte/application/actions";
import {
  runDismissActionTask,
  type DismissActionRequest,
  type DismissActionResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_ROUTE_CONFIG } from "~/lib/server/needs-you-route-config";
import { resolveRequestSession } from "~/lib/server/request-session";
import { type HttpStatusCode } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseItemId,
  parseJsonBody,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorJsonResponse,
  toWorkflowRouteErrorJsonResponse,
} from "~/lib/server/workflow-route-error";

function parseDismissBody(value: unknown): DismissActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseItemId(body);
  if (!itemId) {
    return null;
  }

  return {
    itemId,
  };
}

export async function POST(request: Request) {
  const config = NEEDS_YOU_ROUTE_CONFIG.actionDismiss;
  const route = config.route;
  const taskId = config.taskId;
  const method = request.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
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

    const payload = parseDismissBody(await parseJsonBody(request));
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
    const response: DismissActionResponse = result;
    requestLog.info(config.events.success, {
      route,
      method,
      status,
      itemId,
      userId,
      taskId,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof DismissError) {
      status = resolveWorkflowDomainStatus(error.message);
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

    const resolved = resolveWorkflowRouteError(error, config.messages.taskUnavailable);
    status = resolved.status;
    requestLog.error(config.events.taskError, {
      route,
      method,
      status,
      itemId,
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
      itemId,
      userId,
      taskId,
      durationMs: Date.now() - startedAt,
    });
  }
}
