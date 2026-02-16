import { createAuthorizationErrorResponse, requireAuthorizedSession } from "~/lib/server/authz";
import { rateLimitRequest } from "~/lib/server/rate-limit";
import { createRateLimitResponse } from "~/lib/server/rate-limit-response";
import { getTrustReport } from "~/lib/server/trust-report";
import { ResultAsync } from "neverthrow";

export async function GET(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "admin:trust:read", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const report = await ResultAsync.fromPromise(getTrustReport(new Date()), () => {
    return new Error("Failed to load trust report.");
  });
  return report.match(
    (value) => Response.json(value),
    () => Response.json({ error: "Failed to load trust report." }, { status: 500 }),
  );
}
