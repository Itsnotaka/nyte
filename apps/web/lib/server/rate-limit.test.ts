import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRateLimitConfigSignature,
  getRateLimitMode,
  getRateLimitProvider,
  isUnkeyRateLimitActive,
  isUnkeyRateLimitConfigured,
  rateLimitRequest,
  resetRateLimitState,
} from "./rate-limit";

describe("rateLimitRequest", () => {
  beforeEach(() => {
    delete process.env.UNKEY_ROOT_KEY;
    delete process.env.NYTE_RATE_LIMIT_MODE;
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

  it("isolates counters for same scope with different limits", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.9",
      },
    });

    const strictFirst = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const strictSecond = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const relaxed = await rateLimitRequest(request, "approve", {
      limit: 3,
      windowMs: 60_000,
    });

    expect(strictFirst.isOk()).toBe(true);
    expect(strictSecond.isErr()).toBe(true);
    expect(relaxed.isOk()).toBe(true);
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

  it("reports memory provider when Unkey root key is absent", () => {
    delete process.env.UNKEY_ROOT_KEY;

    expect(getRateLimitProvider()).toBe("memory");
    expect(isUnkeyRateLimitConfigured()).toBe(false);
    expect(isUnkeyRateLimitActive()).toBe(false);
    expect(getRateLimitConfigSignature()).toBe("memory:auto");
    expect(getRateLimitMode()).toBe("auto");
  });

  it("reports Unkey provider when root key is configured", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";

    expect(getRateLimitProvider()).toBe("unkey");
    expect(isUnkeyRateLimitConfigured()).toBe(true);
    expect(isUnkeyRateLimitActive()).toBe(true);
    expect(getRateLimitConfigSignature()).toMatch(/^unkey:auto:[a-f0-9]{12}$/);
    expect(getRateLimitMode()).toBe("auto");
  });

  it("treats whitespace-only root key as not configured", () => {
    process.env.UNKEY_ROOT_KEY = "   ";

    expect(getRateLimitProvider()).toBe("memory");
    expect(isUnkeyRateLimitConfigured()).toBe(false);
    expect(isUnkeyRateLimitActive()).toBe(false);
    expect(getRateLimitConfigSignature()).toBe("memory:auto");
  });

  it("produces distinct signatures when Unkey key changes", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-key-one";
    const one = getRateLimitConfigSignature();

    process.env.UNKEY_ROOT_KEY = "unkey-key-two";
    const two = getRateLimitConfigSignature();

    expect(one).not.toBe(two);
  });

  it("produces distinct signatures for auto and forced-unkey modes with same key", () => {
    process.env.UNKEY_ROOT_KEY = "shared-unkey-key";
    delete process.env.NYTE_RATE_LIMIT_MODE;
    const autoSignature = getRateLimitConfigSignature();

    process.env.NYTE_RATE_LIMIT_MODE = "unkey";
    const forcedUnkeySignature = getRateLimitConfigSignature();

    expect(autoSignature).toMatch(/^unkey:auto:[a-f0-9]{12}$/);
    expect(forcedUnkeySignature).toMatch(/^unkey:unkey:[a-f0-9]{12}$/);
    expect(autoSignature).not.toBe(forcedUnkeySignature);
  });

  it("produces distinct signatures for auto-memory and forced-memory modes", () => {
    delete process.env.UNKEY_ROOT_KEY;
    delete process.env.NYTE_RATE_LIMIT_MODE;
    const autoSignature = getRateLimitConfigSignature();

    process.env.NYTE_RATE_LIMIT_MODE = "memory";
    const forcedMemorySignature = getRateLimitConfigSignature();

    expect(autoSignature).toBe("memory:auto");
    expect(forcedMemorySignature).toBe("memory:forced");
    expect(autoSignature).not.toBe(forcedMemorySignature);
  });

  it("allows explicit memory mode override", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";
    process.env.NYTE_RATE_LIMIT_MODE = "memory";

    expect(getRateLimitMode()).toBe("memory");
    expect(getRateLimitProvider()).toBe("memory");
    expect(isUnkeyRateLimitActive()).toBe(false);
    expect(getRateLimitConfigSignature()).toBe("memory:forced");
  });

  it("allows explicit unkey mode override", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";
    process.env.NYTE_RATE_LIMIT_MODE = "unkey";

    expect(getRateLimitMode()).toBe("unkey");
    expect(getRateLimitProvider()).toBe("unkey");
    expect(isUnkeyRateLimitActive()).toBe(true);
    expect(getRateLimitConfigSignature()).toMatch(/^unkey:unkey:[a-f0-9]{12}$/);
  });

  it("falls back to memory when unkey mode is forced without key", () => {
    delete process.env.UNKEY_ROOT_KEY;
    process.env.NYTE_RATE_LIMIT_MODE = "unkey";

    expect(getRateLimitMode()).toBe("unkey");
    expect(getRateLimitProvider()).toBe("memory");
    expect(isUnkeyRateLimitActive()).toBe(false);
    expect(getRateLimitConfigSignature()).toBe("unkey:missing-key");
  });

  it("normalizes unknown mode values to auto", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";
    process.env.NYTE_RATE_LIMIT_MODE = "invalid-mode";

    expect(getRateLimitMode()).toBe("auto");
    expect(getRateLimitProvider()).toBe("unkey");
  });

  it("normalizes unknown mode values to auto without Unkey key", () => {
    delete process.env.UNKEY_ROOT_KEY;
    process.env.NYTE_RATE_LIMIT_MODE = "invalid-mode";

    expect(getRateLimitMode()).toBe("auto");
    expect(getRateLimitProvider()).toBe("memory");
    expect(isUnkeyRateLimitActive()).toBe(false);
    expect(getRateLimitConfigSignature()).toBe("memory:auto");
  });

  it("normalizes whitespace and casing in mode values", () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";
    process.env.NYTE_RATE_LIMIT_MODE = "  MEMORY  ";

    expect(getRateLimitMode()).toBe("memory");
    expect(getRateLimitProvider()).toBe("memory");

    process.env.NYTE_RATE_LIMIT_MODE = " UnKeY ";
    expect(getRateLimitMode()).toBe("unkey");
    expect(getRateLimitProvider()).toBe("unkey");
  });

  it("isolates fallback counters when mode toggles from auto to forced-unkey without key", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.44",
      },
    });

    const autoFirst = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const autoSecond = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    process.env.NYTE_RATE_LIMIT_MODE = "unkey";
    const forcedUnkeyWithoutKey = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    expect(autoFirst.isOk()).toBe(true);
    expect(autoSecond.isErr()).toBe(true);
    expect(forcedUnkeyWithoutKey.isOk()).toBe(true);
  });

  it("isolates fallback counters when mode toggles from auto to forced-memory without key", async () => {
    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.45",
      },
    });

    const autoFirst = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });
    const autoSecond = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    process.env.NYTE_RATE_LIMIT_MODE = "memory";
    const forcedMemory = await rateLimitRequest(request, "approve", {
      limit: 1,
      windowMs: 60_000,
    });

    expect(autoFirst.isOk()).toBe(true);
    expect(autoSecond.isErr()).toBe(true);
    expect(forcedMemory.isOk()).toBe(true);
  });

  it("uses memory limiter when memory mode is forced with Unkey key present", async () => {
    process.env.UNKEY_ROOT_KEY = "unkey-test-key";
    process.env.NYTE_RATE_LIMIT_MODE = "memory";

    const request = new Request("http://localhost:3000/api/actions/approve", {
      headers: {
        "x-forwarded-for": "10.0.0.55",
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
    expect(getRateLimitProvider()).toBe("memory");
  });
});
