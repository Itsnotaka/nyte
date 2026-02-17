import { DismissError } from "@nyte/application/actions";
import {
  WORKFLOW_TASK_IDS,
  runDismissActionTask,
  type DismissActionRequest,
  type DismissActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { resolveRequestSession } from "~/lib/server/request-session";
import {
  asObjectPayload,
  parseJsonBody,
  parseRequiredStringField,
} from "~/lib/server/request-validation";
import {
  ACTION_AUTH_REQUIRED_MESSAGE,
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
} from "~/lib/server/workflow-route-error";

function parseDismissBody(value: unknown): DismissActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseRequiredStringField(body, "itemId");
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
  let status = 200;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info("action.dismiss.start", {
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
      status = 401;
      const response: WorkflowApiErrorResponse = { error: ACTION_AUTH_REQUIRED_MESSAGE };
      requestLog.warn("action.dismiss.unauthorized", {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }

    const payload = parseDismissBody(await parseJsonBody(request));
    if (!payload) {
      status = 400;
      const response: WorkflowApiErrorResponse = { error: "Invalid dismissal payload." };
      requestLog.warn("action.dismiss.invalid-payload", {
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
    requestLog.info("action.dismiss.success", {
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
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.warn("action.dismiss.domain-error", {
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

    const resolved = resolveWorkflowRouteError(error, "Unable to dismiss action.");
    status = resolved.status;
    requestLog.error(resolved.logData.message, {
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
