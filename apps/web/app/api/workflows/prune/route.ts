import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { pruneWorkflowHistory } from "@/lib/server/workflow-retention";

export async function POST(request: Request) {
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
