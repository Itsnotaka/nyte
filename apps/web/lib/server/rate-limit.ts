type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
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
  now?: number;
};

export function enforceRateLimit(
  request: Request,
  scope: string,
  { limit = 60, windowMs = 60_000, now = Date.now() }: RateLimitOptions = {},
) {
  const key = `${scope}:${getClientAddress(request)}`;
  const existing = buckets.get(key);
  const resetAt = now + windowMs;

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt,
    });
    return;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new RateLimitError("Too many requests. Please retry shortly.", retryAfterSeconds);
  }

  buckets.set(key, {
    count: existing.count + 1,
    resetAt: existing.resetAt,
  });
}

export function resetRateLimitState() {
  buckets.clear();
}
