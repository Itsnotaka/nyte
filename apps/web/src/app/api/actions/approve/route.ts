import { ApprovalError } from "@nyte/application/actions";
import { isToolCallPayload } from "@nyte/domain/actions";
import {
  WORKFLOW_TASK_IDS,
  runApproveActionTask,
  type ApproveActionRequest,
  type ApproveActionResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { REQUEST_EVENTS } from "~/lib/server/request-events";
import { resolveRequestSession } from "~/lib/server/request-session";
import { HTTP_STATUS } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseJsonBody,
  parseOptionalStringField,
  parseRequiredStringField,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorResponse,
} from "~/lib/server/workflow-route-error";

function parseApproveBody(value: unknown): ApproveActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseRequiredStringField(body, "itemId");
  if (!itemId) {
    return null;
  }

  const idempotencyKey = parseOptionalStringField(body, "idempotencyKey", {
    requireNonEmpty: true,
  });
  if (idempotencyKey === null) {
    return null;
  }

  const parsedBody: ApproveActionRequest = {
    itemId,
    idempotencyKey,
  };

  if (body.payloadOverride !== undefined) {
    if (!isToolCallPayload(body.payloadOverride)) {
      return null;
    }

    parsedBody.payloadOverride = body.payloadOverride;
  }

  return parsedBody;
}

export async function POST(request: Request) {
  const route = NEEDS_YOU_API_ROUTES.approveAction;
  const taskId = WORKFLOW_TASK_IDS.approveAction;
  const method = request.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status: number = HTTP_STATUS.ok;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info(REQUEST_EVENTS.actionApprove.start, {
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
      requestLog.warn(REQUEST_EVENTS.actionApprove.unauthorized, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }

    const payload = parseApproveBody(await parseJsonBody(request));
    if (!payload) {
      status = HTTP_STATUS.badRequest;
      const response = toWorkflowApiErrorResponse(NEEDS_YOU_MESSAGES.invalidApprovePayload);
      requestLog.warn(REQUEST_EVENTS.actionApprove.invalidPayload, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }
    itemId = payload.itemId;

    const result = await runApproveActionTask({
      itemId: payload.itemId,
      idempotencyKey: payload.idempotencyKey,
      payloadOverride: payload.payloadOverride,
      actorUserId: userId,
    });
    const response: ApproveActionResponse = result;
    requestLog.info(REQUEST_EVENTS.actionApprove.success, {
      route,
      method,
      status,
      itemId,
      userId,
      taskId,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof ApprovalError) {
      status = resolveWorkflowDomainStatus(error.message);
      const response = toWorkflowApiErrorResponse(error.message);
      requestLog.warn(REQUEST_EVENTS.actionApprove.domainError, {
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

    const resolved = resolveWorkflowRouteError(error, NEEDS_YOU_MESSAGES.approveUnavailable);
    status = resolved.status;
    requestLog.error(REQUEST_EVENTS.actionApprove.taskError, {
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
