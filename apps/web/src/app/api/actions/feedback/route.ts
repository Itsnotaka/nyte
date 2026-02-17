import { FeedbackError } from "@nyte/application/actions";
import {
  runFeedbackTask,
  type FeedbackActionRequest,
  type FeedbackActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveWorkflowRouteError } from "~/lib/server/workflow-route-error";

function parseFeedbackBody(value: unknown): FeedbackActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<keyof FeedbackActionRequest, unknown>;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  if (body.rating !== "positive" && body.rating !== "negative") {
    return null;
  }

  if (body.note !== undefined && typeof body.note !== "string") {
    return null;
  }

  const note = body.note?.trim();

  return {
    itemId: body.itemId.trim(),
    rating: body.rating,
    note: note && note.length > 0 ? note : undefined,
  };
}

export async function POST(request: Request) {
  const route = "/api/actions/feedback";
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let itemId: string | undefined;

  requestLog.info("action.feedback.start", {
    route,
    method: request.method,
  });

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      status = 401;
      const response: WorkflowApiErrorResponse = { error: "Authentication required." };
      requestLog.warn("action.feedback.unauthorized", {
        route,
        method: request.method,
        status,
      });
      return Response.json(response, { status });
    }

    const payload = parseFeedbackBody(await request.json());
    if (!payload) {
      status = 400;
      const response: WorkflowApiErrorResponse = { error: "Invalid feedback payload." };
      requestLog.warn("action.feedback.invalid-payload", {
        route,
        method: request.method,
        status,
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
    requestLog.info("action.feedback.success", {
      route,
      method: request.method,
      status,
      itemId,
      taskId: "workflow.feedback",
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof FeedbackError) {
      status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.warn("action.feedback.domain-error", {
        route,
        method: request.method,
        status,
        itemId,
        message: error.message,
      });
      return Response.json(response, { status });
    }

    const resolved = resolveWorkflowRouteError(error, "Unable to record feedback.");
    status = resolved.status;
    requestLog.error(resolved.logData.message, {
      route,
      method: request.method,
      status,
      itemId,
      taskId: resolved.logData.taskId,
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
      durationMs: Date.now() - startedAt,
    });
  }
}
