import { ApprovalError } from "@nyte/application/actions";
import {
  runApproveActionTask,
  type ApproveActionRequest,
  type ApproveActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";

function parseApproveBody(value: unknown): ApproveActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<keyof ApproveActionRequest, unknown>;
  if (typeof body.itemId !== "string" || body.itemId.trim().length === 0) {
    return null;
  }

  if (body.idempotencyKey === undefined) {
    return {
      itemId: body.itemId.trim(),
    };
  }

  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length === 0) {
    return null;
  }

  return {
    itemId: body.itemId.trim(),
    idempotencyKey: body.idempotencyKey.trim(),
  };
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    const response: WorkflowApiErrorResponse = { error: "Authentication required." };
    return Response.json(response, { status: 401 });
  }

  const payload = parseApproveBody(await request.json());
  if (!payload) {
    const response: WorkflowApiErrorResponse = { error: "Invalid approval payload." };
    return Response.json(response, { status: 400 });
  }

  try {
    const result = await runApproveActionTask({
      itemId: payload.itemId,
      idempotencyKey: payload.idempotencyKey,
    });
    const response: ApproveActionResponse = result;
    return Response.json(response);
  } catch (error) {
    if (error instanceof ApprovalError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      return Response.json(response, { status });
    }

    const response: WorkflowApiErrorResponse = { error: "Unable to approve action." };
    return Response.json(response, { status: 502 });
  }
}
