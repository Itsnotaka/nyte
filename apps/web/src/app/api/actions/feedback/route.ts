import { FeedbackError } from "@nyte/application/actions";
import {
  runFeedbackTask,
  type FeedbackActionRequest,
  type FeedbackActionResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";

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
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    const response: WorkflowApiErrorResponse = { error: "Authentication required." };
    return Response.json(response, { status: 401 });
  }

  const payload = parseFeedbackBody(await request.json());
  if (!payload) {
    const response: WorkflowApiErrorResponse = { error: "Invalid feedback payload." };
    return Response.json(response, { status: 400 });
  }

  try {
    const result = await runFeedbackTask({
      itemId: payload.itemId,
      rating: payload.rating,
      note: payload.note,
    });
    const response: FeedbackActionResponse = result;
    return Response.json(response);
  } catch (error) {
    if (error instanceof FeedbackError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      const response: WorkflowApiErrorResponse = { error: error.message };
      return Response.json(response, { status });
    }

    const response: WorkflowApiErrorResponse = { error: "Unable to record feedback." };
    return Response.json(response, { status: 502 });
  }
}
