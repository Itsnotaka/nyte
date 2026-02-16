import { describe, expect, it } from "vitest";

import { RateLimitError } from "./rate-limit";
import { createRateLimitResponse } from "./rate-limit-response";

describe("createRateLimitResponse", () => {
  it("returns 429 payload and Retry-After header", async () => {
    const response = createRateLimitResponse(new RateLimitError("Too many requests", 429, 12));
    const body = (await response.json()) as {
      error: string;
      retryAfterSeconds: number;
    };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(body.retryAfterSeconds).toBe(12);
  });

  it("returns service error payload without Retry-After header", async () => {
    const response = createRateLimitResponse(
      new RateLimitError("Failed to evaluate rate limit.", 503),
    );
    const body = (await response.json()) as {
      error: string;
      retryAfterSeconds?: number;
    };

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(body.retryAfterSeconds).toBeUndefined();
  });
});
