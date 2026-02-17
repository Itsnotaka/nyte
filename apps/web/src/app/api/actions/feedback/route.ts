import { FeedbackError } from "@nyte/application/actions";
import {
  WORKFLOW_TASK_IDS,
  runFeedbackTask,
  type FeedbackActionRequest,
  type FeedbackActionResponse,
} from "@nyte/workflows";

import { createApiRequestLogger } from "~/lib/server/request-log";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { REQUEST_EVENTS } from "~/lib/server/request-events";
import { resolveRequestSession } from "~/lib/server/request-session";
import { HTTP_STATUS } from "~/lib/server/http-status";
import {
  asObjectPayload,
  parseEnumValue,
  parseJsonBody,
  parseOptionalStringField,
  parseRequiredStringField,
} from "~/lib/server/request-validation";
import {
  resolveWorkflowDomainStatus,
  resolveWorkflowRouteError,
  toWorkflowApiErrorResponse,
} from "~/lib/server/workflow-route-error";

const FEEDBACK_RATINGS = ["positive", "negative"] as const satisfies readonly FeedbackActionRequest["rating"][];

function parseFeedbackBody(value: unknown): FeedbackActionRequest | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseRequiredStringField(body, "itemId");
  if (!itemId) {
    return null;
  }

  const rating = parseEnumValue(body.rating, FEEDBACK_RATINGS);
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
  const route = NEEDS_YOU_API_ROUTES.feedbackAction;
  const taskId = WORKFLOW_TASK_IDS.feedback;
  const method = request.method;
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status: number = HTTP_STATUS.ok;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info(REQUEST_EVENTS.actionFeedback.start, {
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
      requestLog.warn(REQUEST_EVENTS.actionFeedback.unauthorized, {
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
      const response = toWorkflowApiErrorResponse(NEEDS_YOU_MESSAGES.invalidFeedbackPayload);
      requestLog.warn(REQUEST_EVENTS.actionFeedback.invalidPayload, {
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
    requestLog.info(REQUEST_EVENTS.actionFeedback.success, {
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
      requestLog.warn(REQUEST_EVENTS.actionFeedback.domainError, {
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

    const resolved = resolveWorkflowRouteError(error, NEEDS_YOU_MESSAGES.feedbackUnavailable);
    status = resolved.status;
    requestLog.error(REQUEST_EVENTS.actionFeedback.taskError, {
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
