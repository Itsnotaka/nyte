import { pollGmailIngestion } from "@/lib/integrations/gmail/polling";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { getDashboardData } from "@/lib/server/dashboard";
import { listWatchKeywords } from "@/lib/server/policy-rules";
import { persistSignals } from "@/lib/server/queue-store";

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
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
  const dashboard = await getDashboardData();

  return Response.json({
    cursor: pollResult.nextCursor,
    signals: pollResult.signals,
    ...dashboard,
  });
}
