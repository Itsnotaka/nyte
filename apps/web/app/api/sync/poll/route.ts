import { pollGmailIngestion } from "@/lib/integrations/gmail/polling";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { getDashboardData } from "@/lib/server/dashboard";
import { listWatchKeywords } from "@/lib/server/policy-rules";
import { persistSignals } from "@/lib/server/queue-store";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { pruneWorkflowHistoryIfDue } from "@/lib/server/workflow-retention";

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "sync:poll", {
      limit: 30,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const now = new Date();
  const watchKeywords = await listWatchKeywords();
  const pollResult = pollGmailIngestion({
    cursor,
    now,
    watchKeywords,
  });
  await persistSignals(pollResult.signals, now);
  await pruneWorkflowHistoryIfDue(now);
  const dashboard = await getDashboardData();

  return Response.json({
    cursor: pollResult.nextCursor,
    signals: pollResult.signals,
    ...dashboard,
  });
}
