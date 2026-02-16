import { beforeEach, describe, expect, it } from "vitest";

import { enforceRateLimit, RateLimitError, resetRateLimitState } from "./rate-limit";

describe("enforceRateLimit", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("allows requests under the limit", () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    });

    expect(() =>
      enforceRateLimit(request, "approve", {
        limit: 2,
        windowMs: 60_000,
        now: 1_000,
      }),
    ).not.toThrow();
    expect(() =>
      enforceRateLimit(request, "approve", {
        limit: 2,
        windowMs: 60_000,
        now: 1_010,
      }),
    ).not.toThrow();
  });

  it("throws when the request budget is exhausted", () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.2",
      },
    });

    enforceRateLimit(request, "approve", {
      limit: 1,
      windowMs: 60_000,
      now: 1_000,
    });

    expect(() =>
      enforceRateLimit(request, "approve", {
        limit: 1,
        windowMs: 60_000,
        now: 1_010,
      }),
    ).toThrow(RateLimitError);
  });
});
