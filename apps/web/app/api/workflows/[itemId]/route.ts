import { getWorkflowTimeline } from "@/lib/server/workflow-log";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

type Params = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "workflows:item:read", {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const { itemId } = await params;
  const normalizedItemId = itemId.trim();
  if (!normalizedItemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }

  const timeline = await ResultAsync.fromPromise(getWorkflowTimeline(normalizedItemId), () => {
    return new Error("Failed to load workflow timeline.");
  });
  return timeline.match(
    (value) =>
      Response.json({
        itemId: normalizedItemId,
        timeline: value,
      }),
    () => Response.json({ error: "Failed to load workflow timeline." }, { status: 500 }),
  );
}
