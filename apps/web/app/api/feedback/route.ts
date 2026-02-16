import { FeedbackError, recordFeedback, type FeedbackRating } from "@/lib/server/feedback";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type FeedbackBody = {
  itemId?: string;
  rating?: FeedbackRating;
  note?: string;
};

const allowedRatings: FeedbackRating[] = ["positive", "negative"];

export async function POST(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "feedback:create", {
      limit: 40,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: FeedbackBody;
  try {
    body = await readJsonBody<FeedbackBody>(request);
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const itemId = body.itemId?.trim();
  if (!itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }
  if (!body.rating || !allowedRatings.includes(body.rating)) {
    return Response.json({ error: "rating must be positive or negative." }, { status: 400 });
  }

  try {
    const result = await recordFeedback(itemId, body.rating, body.note, new Date());
    return Response.json(result);
  } catch (error) {
    if (error instanceof FeedbackError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to record feedback." }, { status: 500 });
  }
}
