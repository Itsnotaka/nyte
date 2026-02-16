import { Ratelimit, type Ratelimiter, type RatelimitResponse } from "@unkey/ratelimit";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, Bucket>();
const ratelimiterCache = new Map<string, Ratelimiter>();

export class RateLimitError extends Error {
  retryAfterSeconds?: number;
  status: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "RateLimitError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  const forwardedAddress = forwarded.map((entry) => entry.trim()).find(Boolean);
  if (forwardedAddress) {
    return forwardedAddress;
  }

  const realIp = request.headers.get("x-real-ip")?.split(",") ?? [];
  const realIpAddress = realIp.map((entry) => entry.trim()).find(Boolean);
  return realIpAddress ?? "unknown";
}

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
};

class MemoryRatelimiter implements Ratelimiter {
  constructor(
    private readonly namespace: string,
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  async limit(identifier: string): Promise<RatelimitResponse> {
    const key = `${this.namespace}:${identifier}`;
    const now = Date.now();
    const existing = memoryBuckets.get(key);
    const resetAt = now + this.windowMs;

    if (!existing || existing.resetAt <= now) {
      memoryBuckets.set(key, {
        count: 1,
        resetAt,
      });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - 1),
        reset: resetAt,
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: existing.resetAt,
      };
    }

    const nextCount = existing.count + 1;
    memoryBuckets.set(key, {
      count: nextCount,
      resetAt: existing.resetAt,
    });
    return {
      success: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - nextCount),
      reset: existing.resetAt,
    };
  }
}

function normalizeNamespace(scope: string) {
  return `nyte-${scope.replace(/[^a-zA-Z0-9:_-]/g, "-")}`;
}

function getRatelimiter(scope: string, limit: number, windowMs: number): Ratelimiter {
  const provider = process.env.UNKEY_ROOT_KEY ? "unkey" : "memory";
  const cacheKey = `${provider}:${scope}:${limit}:${windowMs}`;
  const existing = ratelimiterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const namespace = normalizeNamespace(scope);
  const ratelimiter = process.env.UNKEY_ROOT_KEY
    ? new Ratelimit({
        rootKey: process.env.UNKEY_ROOT_KEY,
        namespace,
        limit,
        duration: windowMs,
        timeout: {
          ms: 3_000,
          fallback: () => ({
            success: false,
            limit,
            remaining: 0,
            reset: Date.now() + windowMs,
          }),
        },
        onError: () => ({
          success: false,
          limit,
          remaining: 0,
          reset: Date.now() + windowMs,
        }),
      })
    : new MemoryRatelimiter(namespace, limit, windowMs);

  ratelimiterCache.set(cacheKey, ratelimiter);
  return ratelimiter;
}

export function rateLimitRequest(
  request: Request,
  scope: string,
  { limit = 60, windowMs = 60_000 }: RateLimitOptions = {},
): ResultAsync<void, RateLimitError> {
  const identifier = getClientAddress(request);
  const ratelimiter = getRatelimiter(scope, limit, windowMs);

  return ResultAsync.fromPromise(ratelimiter.limit(identifier), () => {
    return new RateLimitError("Failed to evaluate rate limit.", 503);
  }).andThen((result) => {
    if (result.success) {
      return okAsync(undefined);
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return errAsync(
      new RateLimitError("Too many requests. Please retry shortly.", 429, retryAfterSeconds),
    );
  });
}

export function resetRateLimitState() {
  memoryBuckets.clear();
  ratelimiterCache.clear();
}
