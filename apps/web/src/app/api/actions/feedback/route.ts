import { FeedbackError } from "@nyte/application/actions";
import {
  FEEDBACK_ACTION_RATINGS,
  runFeedbackTask,
  type FeedbackActionRequest,
  type FeedbackActionResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_ROUTE_CONFIG } from "~/lib/server/needs-you-route-config";
import { resolveRequestSession } from "~/lib/server/request-session";
import { type HttpStatusCode, HTTP_STATUS } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseItemId,
  parseEnumValue,
  parseJsonBody,
  parseOptionalStringField,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorResponse,
} from "~/lib/server/workflow-route-error";

function parseFeedbackBody(value: unknown): FeedbackActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseItemId(body);
  if (!itemId) {
    return null;
  }

  const rating = parseEnumValue(body.rating, FEEDBACK_ACTION_RATINGS);
  if (!rating) {
    return null;
  }

  const note = parseOptionalStringField(body, "note");
  if (note === null) {
    return null;
  }

  return {
    itemId,
    rating,
    note,
  };
}

export async function POST(request: Request) {
  const config = NEEDS_YOU_ROUTE_CONFIG.actionFeedback;
  const route = config.route;
  const taskId = config.taskId;
  const method = request.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status: HttpStatusCode = HTTP_STATUS.ok;
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
      status = HTTP_STATUS.unauthorized;
      const response = toWorkflowApiErrorResponse(config.messages.authRequired);
      requestLog.warn(config.events.unauthorized, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }

    const payload = parseFeedbackBody(await parseJsonBody(request));
    if (!payload) {
      status = HTTP_STATUS.badRequest;
      const response = toWorkflowApiErrorResponse(config.messages.invalidPayload);
      requestLog.warn(config.events.invalidPayload, {
        route,
        method,
        status,
        taskId,
      });
      return Response.json(response, { status });
    }
    itemId = payload.itemId;

    const result = await runFeedbackTask({
      itemId: payload.itemId,
      rating: payload.rating,
      note: payload.note,
    });
    const response: FeedbackActionResponse = result;
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
    if (error instanceof FeedbackError) {
      status = resolveWorkflowDomainStatus(error.message);
      const response = toWorkflowApiErrorResponse(error.message);
      requestLog.warn(config.events.domainError, {
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
