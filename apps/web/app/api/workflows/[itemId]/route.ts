import { getWorkflowTimeline } from "@/lib/server/workflow-log";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type Params = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "workflows:item:read", {
      limit: 120,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const { itemId } = await params;
  const normalizedItemId = itemId.trim();
  if (!normalizedItemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }

  const timeline = await getWorkflowTimeline(normalizedItemId);
  return Response.json({
    itemId: normalizedItemId,
    timeline,
  });
}
