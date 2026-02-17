import { DismissError } from "@nyte/application/actions";
import {
  dismissActionTask,
  type DismissActionRequest,
  type DismissActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";

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
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    const response: WorkflowApiErrorResponse = { error: "Authentication required." };
    return Response.json(response, { status: 401 });
  }

  const payload = parseDismissBody(await request.json());
  if (!payload) {
    const response: WorkflowApiErrorResponse = { error: "Invalid dismissal payload." };
    return Response.json(response, { status: 400 });
  }

  try {
    const result = await dismissActionTask({
      itemId: payload.itemId,
      now: new Date(),
    });
    const response: DismissActionResponse = result;
    return Response.json(response);
  } catch (error) {
    if (error instanceof DismissError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      return Response.json(response, { status });
    }

    const response: WorkflowApiErrorResponse = { error: "Unable to dismiss action." };
    return Response.json(response, { status: 502 });
  }
}
