import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimitRequest, resetRateLimitState } from "./rate-limit";

describe("rateLimitRequest", () => {
  beforeEach(() => {
    delete process.env.UNKEY_ROOT_KEY;
    resetRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:01.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    });

    const first = await rateLimitRequest(request, "approve", {
      limit: 2,
      windowMs: 60_000,
    });
    const second = await rateLimitRequest(request, "approve", {
      limit: 2,
      windowMs: 60_000,
    });

    expect(first.isOk()).toBe(true);
    expect(second.isOk()).toBe(true);
  });

  it("returns error when the request budget is exhausted", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.2",
      },
    });

    const first = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const second = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    expect(first.isOk()).toBe(true);
    expect(second.isErr()).toBe(true);
    if (second.isErr()) {
      expect(second.error.status).toBe(429);
    }
  });

  it("uses first forwarded address from comma-separated chain", async () => {
    const primaryRequest = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "198.51.100.10, 198.51.100.20",
      },
    });
    const samePrimaryRequest = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "198.51.100.10,198.51.100.21",
      },
    });

    const first = await rateLimitRequest(primaryRequest, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const second = await rateLimitRequest(samePrimaryRequest, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    expect(first.isOk()).toBe(true);
    expect(second.isErr()).toBe(true);
  });

  it("falls back to x-real-ip when forwarded chain is empty", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": " , ",
        "x-real-ip": "203.0.113.77",
      },
    });
    const sameIpRequest = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-real-ip": "203.0.113.77",
      },
    });

    const first = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const second = await rateLimitRequest(sameIpRequest, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    expect(first.isOk()).toBe(true);
    expect(second.isErr()).toBe(true);
  });
});
