import { RateLimitError } from "./rate-limit";

export function createRateLimitResponse(error: RateLimitError) {
  const headers =
    typeof error.retryAfterSeconds === "number"
      ? {
          "Retry-After": String(error.retryAfterSeconds),
        }
      : undefined;

  return Response.json(
    {
      error: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    },
    {
      status: error.status,
      headers,
    },
  );
}
