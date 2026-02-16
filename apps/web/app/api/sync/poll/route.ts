import { pollGmailIngestion } from "@/lib/integrations/gmail/polling";
import { persistSignals } from "@/lib/server/queue-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const now = new Date();
  const pollResult = pollGmailIngestion({
    cursor,
    now,
  });
  const queue = await persistSignals(pollResult.signals, now);

  return Response.json({
    cursor: pollResult.nextCursor,
    signals: pollResult.signals,
    needsYou: queue,
  });
}
