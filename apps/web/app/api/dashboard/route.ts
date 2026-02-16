import { getDashboardData } from "@/lib/server/dashboard";
import { requireAuthorizedSessionOr401 } from "@/lib/server/authz";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

export async function GET(request: Request) {
  const authorizationResponse = await requireAuthorizedSessionOr401(request);
  if (authorizationResponse) {
    return authorizationResponse;
  }

  try {
    enforceRateLimit(request, "dashboard:read", {
      limit: 120,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const dashboard = await getDashboardData();
  return Response.json(dashboard);
}
