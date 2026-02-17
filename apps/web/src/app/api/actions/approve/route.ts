import { ApprovalError } from "@nyte/application/actions";
import { isToolCallPayload } from "@nyte/domain/actions";
import { runApproveActionTask, type ApproveActionRequest } from "@nyte/workflows";

import { NEEDS_YOU_ROUTE_CONFIG, type HttpStatusCode } from "~/lib/server/needs-you-route-config";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveAuthenticatedRequestSession } from "~/lib/server/request-session";
import {
  parseBodyWithItemId,
  parseOptionalStringField,
  parseRequestPayload,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowErrorTaskId,
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorJsonResponse,
  toWorkflowRouteErrorJsonResponse,
} from "~/lib/server/workflow-route-error";

function parseApproveBody(value: unknown): ApproveActionRequest | null {
  const parsed = parseBodyWithItemId(value);
  if (!parsed) {
    return null;
  }

  const { body, itemId } = parsed;

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
  const config = NEEDS_YOU_ROUTE_CONFIG.actionApprove;
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

    const payload = await parseRequestPayload(request, parseApproveBody);
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

    const result = await runApproveActionTask({
      itemId: payload.itemId,
      idempotencyKey: payload.idempotencyKey,
      payloadOverride: payload.payloadOverride,
      actorUserId: sessionResolution.userId,
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
    if (error instanceof ApprovalError) {
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
