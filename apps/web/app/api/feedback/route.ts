import { FeedbackError, recordFeedback, type FeedbackRating } from "@/lib/server/feedback";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";

type FeedbackBody = {
  itemId?: string;
  rating?: FeedbackRating;
  note?: string;
};

const allowedRatings: FeedbackRating[] = ["positive", "negative"];

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "feedback:create", {
      limit: 40,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
  }

  const body = (await request.json()) as FeedbackBody;
  if (!body.itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }
  if (!body.rating || !allowedRatings.includes(body.rating)) {
    return Response.json({ error: "rating must be positive or negative." }, { status: 400 });
  }

  try {
    const result = await recordFeedback(body.itemId, body.rating, body.note, new Date());
    return Response.json(result);
  } catch (error) {
    if (error instanceof FeedbackError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to record feedback." }, { status: 500 });
  }
}
