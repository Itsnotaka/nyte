import { getDashboardData } from "@/lib/server/dashboard";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

export async function GET(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "dashboard:read", {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const dashboard = await ResultAsync.fromPromise(getDashboardData(), () => {
    return new Error("Failed to load dashboard.");
  });

  return dashboard.match(
    (value) => Response.json(value),
    () => Response.json({ error: "Failed to load dashboard." }, { status: 500 }),
  );
}
