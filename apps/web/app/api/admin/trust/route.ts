import { requireAuthorizedSessionOr401 } from "@/lib/server/authz";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { getTrustReport } from "@/lib/server/trust-report";

export async function GET(request: Request) {
  const authorizationResponse = await requireAuthorizedSessionOr401(request);
  if (authorizationResponse) {
    return authorizationResponse;
  }

  try {
    enforceRateLimit(request, "admin:trust:read", {
      limit: 30,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const report = await getTrustReport(new Date());
  return Response.json(report);
}
