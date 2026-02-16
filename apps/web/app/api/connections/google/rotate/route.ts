import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { rotateGoogleConnectionSecrets } from "@/lib/server/connections";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

export async function POST(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "connections:google:rotate", {
      limit: 10,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  try {
    const result = await rotateGoogleConnectionSecrets(new Date());
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to rotate stored Google connection secrets." },
      { status: 500 },
    );
  }
}
