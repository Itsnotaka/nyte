import { ApprovalError } from "@nyte/application/actions";
import { isToolCallPayload } from "@nyte/domain/actions";
import {
  WORKFLOW_TASK_IDS,
  runApproveActionTask,
  type ApproveActionRequest,
  type ApproveActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveRequestSession } from "~/lib/server/request-session";
import {
  asObjectPayload,
  parseJsonBody,
  parseOptionalString,
  parseRequiredString,
} from "~/lib/server/request-validation";
import {
  ACTION_AUTH_REQUIRED_MESSAGE,
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
} from "~/lib/server/workflow-route-error";

function parseApproveBody(value: unknown): ApproveActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseRequiredString(body.itemId);
  if (!itemId) {
    return null;
  }

  const idempotencyKey = parseOptionalString(body.idempotencyKey, {
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
  const route = "/api/actions/approve";
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info("action.approve.start", {
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
      const response: WorkflowApiErrorResponse = { error: ACTION_AUTH_REQUIRED_MESSAGE };
      requestLog.warn("action.approve.unauthorized", {
        route,
        method: request.method,
        status,
      });
      return Response.json(response, { status });
    }

    const payload = parseApproveBody(await parseJsonBody(request));
    if (!payload) {
      status = 400;
      const response: WorkflowApiErrorResponse = { error: "Invalid approval payload." };
      requestLog.warn("action.approve.invalid-payload", {
        route,
        method: request.method,
        status,
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
    requestLog.info("action.approve.success", {
      route,
      method: request.method,
      status,
      itemId,
      userId,
      taskId: WORKFLOW_TASK_IDS.approveAction,
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof ApprovalError) {
      status = resolveWorkflowDomainStatus(error.message);
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.warn("action.approve.domain-error", {
        route,
        method: request.method,
        status,
        itemId,
        userId,
        message: error.message,
      });
      return Response.json(response, { status });
    }

    const resolved = resolveWorkflowRouteError(error, "Unable to approve action.");
    status = resolved.status;
    requestLog.error(resolved.logData.message, {
      route,
      method: request.method,
      status,
      itemId,
      userId,
      taskId: resolved.logData.taskId,
      stage: resolved.logData.stage,
      errorTag: resolved.logData.errorTag,
      message: resolved.logData.message,
    });
    return Response.json(resolved.response, { status });
  } finally {
    requestLog.emit({
      route,
      method: request.method,
      status,
      itemId,
      userId,
      durationMs: Date.now() - startedAt,
    });
  }
}
