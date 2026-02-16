import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { pruneWorkflowHistory } from "@/lib/server/workflow-retention";

export async function POST(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "workflows:prune", {
      limit: 5,
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

  const result = await pruneWorkflowHistory(new Date());
  return Response.json(result);
}
