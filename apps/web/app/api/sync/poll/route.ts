import { createNeedsYouQueue } from "@/lib/domain/triage";
import { pollGmailIngestion } from "@/lib/integrations/gmail/polling";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const pollResult = pollGmailIngestion({
    cursor,
    now: new Date(),
  });
  const queue = createNeedsYouQueue(pollResult.signals, new Date());

  return Response.json({
    cursor: pollResult.nextCursor,
    signals: pollResult.signals,
    needsYou: queue,
  });
}
