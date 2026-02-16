import { FeedbackError, recordFeedback, type FeedbackRating } from "@/lib/server/feedback";
import { requireAuthorizedSessionOr401 } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  isJsonObject,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type FeedbackBody = {
  itemId?: unknown;
  rating?: unknown;
  note?: unknown;
};

const allowedRatings: FeedbackRating[] = ["positive", "negative"];

type NormalizedFeedbackBody =
  | {
      error: string;
    }
  | {
      itemId: string;
      rating: FeedbackRating;
      note?: string;
    };

function normalizeFeedbackBody(body: FeedbackBody): NormalizedFeedbackBody {
  if (body.itemId === undefined) {
    return {
      error: "itemId is required.",
    };
  }

  if (typeof body.itemId !== "string") {
    return {
      error: "itemId must be a string.",
    };
  }

  const itemId = body.itemId.trim();
  if (!itemId) {
    return {
      error: "itemId is required.",
    };
  }

  if (typeof body.rating !== "string" || !allowedRatings.includes(body.rating as FeedbackRating)) {
    return {
      error: "rating must be positive or negative.",
    };
  }

  if (body.note !== undefined && typeof body.note !== "string") {
    return {
      error: "note must be a string.",
    };
  }

  return {
    itemId,
    rating: body.rating as FeedbackRating,
    note: body.note?.trim() || undefined,
  };
}

export async function POST(request: Request) {
  const authorizationResponse = await requireAuthorizedSessionOr401(request);
  if (authorizationResponse) {
    return authorizationResponse;
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

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody<unknown>(request);
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!isJsonObject(rawBody)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const body = rawBody as FeedbackBody;
  const normalized = normalizeFeedbackBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  try {
    const result = await recordFeedback(
      normalized.itemId,
      normalized.rating,
      normalized.note,
      new Date(),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof FeedbackError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to record feedback." }, { status: 500 });
  }
}
