import { DismissError } from "@nyte/application/actions";
import {
  runDismissActionTask,
  type DismissActionRequest,
  type DismissActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";
import { resolveWorkflowRouteError } from "~/lib/server/workflow-route-error";

function parseDismissBody(value: unknown): DismissActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<keyof DismissActionRequest, unknown>;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  return {
    itemId: body.itemId.trim(),
  };
}

export async function POST(request: Request) {
  const route = "/api/actions/dismiss";
  const startedAt = Date.now();
  const requestLog = createApiRequestLogger(request, route);
  let status = 200;
  let itemId: string | undefined;
  let userId: string | null = null;

  requestLog.info("action.dismiss.start", {
    route,
    method: request.method,
  });

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    userId = resolveSessionUserId(session);
    requestLog.set({
      userId,
    });
    if (!session) {
      status = 401;
      const response: WorkflowApiErrorResponse = { error: "Authentication required." };
      requestLog.warn("action.dismiss.unauthorized", {
        route,
        method: request.method,
        status,
      });
      return Response.json(response, { status });
    }

    const payload = parseDismissBody(await request.json());
    if (!payload) {
      status = 400;
      const response: WorkflowApiErrorResponse = { error: "Invalid dismissal payload." };
      requestLog.warn("action.dismiss.invalid-payload", {
        route,
        method: request.method,
        status,
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
      method: request.method,
      status,
      itemId,
      userId,
      taskId: "workflow.dismiss-action",
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof DismissError) {
      status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.warn("action.dismiss.domain-error", {
        route,
        method: request.method,
        status,
        itemId,
        userId,
        message: error.message,
      });
      return Response.json(response, { status });
    }

    const resolved = resolveWorkflowRouteError(error, "Unable to dismiss action.");
    status = resolved.status;
    requestLog.error(resolved.logData.message, {
      route,
      method: request.method,
      status,
      itemId,
      userId,
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
      userId,
      durationMs: Date.now() - startedAt,
    });
  }
}
