import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { rotateGoogleConnectionSecrets } from "@/lib/server/connections";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";

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
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
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
