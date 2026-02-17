import { FeedbackError } from "@nyte/application/actions";
import { feedbackTask } from "@nyte/workflows";

import { auth } from "~/lib/auth";

type FeedbackBody = {
  itemId?: unknown;
  rating?: unknown;
  note?: unknown;
};

function parseFeedbackBody(value: unknown): { itemId: string; rating: "positive" | "negative"; note?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as FeedbackBody;
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
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = parseFeedbackBody(await request.json());
  if (!payload) {
    return Response.json({ error: "Invalid feedback payload." }, { status: 400 });
  }

  try {
    const result = await feedbackTask({
      itemId: payload.itemId,
      rating: payload.rating,
      note: payload.note,
      now: new Date(),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof FeedbackError) {
      const status = error.message.toLowerCase().includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Unable to record feedback." }, { status: 502 });
  }
}
