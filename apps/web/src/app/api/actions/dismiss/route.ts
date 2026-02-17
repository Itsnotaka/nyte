import { DismissError } from "@nyte/application/actions";
import {
  WORKFLOW_TASK_IDS,
  runDismissActionTask,
  type DismissActionRequest,
  type DismissActionResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { REQUEST_EVENTS } from "~/lib/server/request-events";
import { resolveRequestSession } from "~/lib/server/request-session";
import { HTTP_STATUS } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseItemId,
  parseJsonBody,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorResponse,
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
  const route = NEEDS_YOU_API_ROUTES.dismissAction;
  const taskId = WORKFLOW_TASK_IDS.dismissAction;
  const method = request.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status: number = HTTP_STATUS.ok;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info(REQUEST_EVENTS.actionDismiss.start, {
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
      status = HTTP_STATUS.unauthorized;
      const response = toWorkflowApiErrorResponse(NEEDS_YOU_MESSAGES.actionAuthRequired);
      requestLog.warn(REQUEST_EVENTS.actionDismiss.unauthorized, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }

    const payload = parseDismissBody(await parseJsonBody(request));
    if (!payload) {
      status = HTTP_STATUS.badRequest;
      const response = toWorkflowApiErrorResponse(NEEDS_YOU_MESSAGES.invalidDismissPayload);
      requestLog.warn(REQUEST_EVENTS.actionDismiss.invalidPayload, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }
    itemId = payload.itemId;

    const result = await runDismissActionTask({
      itemId: payload.itemId,
    });
    const response: DismissActionResponse = result;
    requestLog.info(REQUEST_EVENTS.actionDismiss.success, {
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
      const response = toWorkflowApiErrorResponse(error.message);
      requestLog.warn(REQUEST_EVENTS.actionDismiss.domainError, {
        route,
        method,
        status,
        itemId,
        userId,
        taskId,
        message: error.message,
      });
      return Response.json(response, { status });
    }

    const resolved = resolveWorkflowRouteError(error, NEEDS_YOU_MESSAGES.dismissUnavailable);
    status = resolved.status;
    requestLog.error(REQUEST_EVENTS.actionDismiss.taskError, {
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
    return Response.json(resolved.response, { status });
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
