import { RateLimitError } from "./rate-limit";

export function createRateLimitResponse(error: RateLimitError) {
  const retryAfter = String(error.retryAfterSeconds);
  return Response.json(
    {
      error: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter,
      },
    },
  );
}
