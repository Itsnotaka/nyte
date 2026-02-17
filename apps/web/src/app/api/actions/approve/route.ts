import { ApprovalError } from "@nyte/application/actions";
import { isToolCallPayload } from "@nyte/domain/actions";
import {
  runApproveActionTask,
  type ApproveActionRequest,
  type ApproveActionResponse,
  WorkflowTaskExecutionError,
  WorkflowTaskResultError,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { createApiRequestLogger } from "~/lib/server/request-log";

function parseApproveBody(value: unknown): ApproveActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<keyof ApproveActionRequest, unknown>;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  if (
    body.idempotencyKey !== undefined &&
    (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length === 0)
  ) {
    return null;
  }

  const parsedBody: ApproveActionRequest = {
    itemId: body.itemId.trim(),
    idempotencyKey:
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined,
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

  requestLog.info("action.approve.start", {
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
      requestLog.warn("action.approve.unauthorized", {
        route,
        method: request.method,
        status,
      });
      return Response.json(response, { status });
    }

    const payload = parseApproveBody(await request.json());
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
    });
    const response: ApproveActionResponse = result;
    requestLog.info("action.approve.success", {
      route,
      method: request.method,
      status,
      itemId,
      taskId: "workflow.approve-action",
    });
    return Response.json(response);
  } catch (error) {
    if (error instanceof ApprovalError) {
      status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.warn("action.approve.domain-error", {
        route,
        method: request.method,
        status,
        itemId,
        message: error.message,
      });
      return Response.json(response, { status });
    }

    if (error instanceof WorkflowTaskExecutionError || error instanceof WorkflowTaskResultError) {
      status = 502;
      const response: WorkflowApiErrorResponse = { error: error.message };
      requestLog.error(error.message, {
        route,
        method: request.method,
        status,
        itemId,
        taskId: error.taskId,
        errorTag: error._tag,
      });
      return Response.json(response, { status });
    }

    status = 502;
    const response: WorkflowApiErrorResponse = { error: "Unable to approve action." };
    requestLog.error("Unable to approve action.", {
      route,
      method: request.method,
      status,
      itemId,
    });
    return Response.json(response, { status });
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
