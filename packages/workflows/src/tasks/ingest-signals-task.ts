import { getDashboardData } from "@nyte/application/dashboard";
import { persistSignals } from "@nyte/application/queue";
import type { WorkItemWithAction } from "@nyte/domain/actions";
import { pollGoogleCalendarIngestion } from "@nyte/integrations/calendar/polling";
import { pollGmailIngestion } from "@nyte/integrations/gmail/polling";

export type IngestSignalsTaskInput = {
  accessToken: string;
  cursor?: string;
  watchKeywords?: string[];
  now?: Date;
};

export type IngestSignalsTaskResult = {
  cursor: string;
  queuedCount: number;
  needsYou: WorkItemWithAction[];
};

export async function ingestSignalsTask({
  accessToken,
  cursor,
  watchKeywords = [],
  now = new Date(),
}: IngestSignalsTaskInput): Promise<IngestSignalsTaskResult> {
  const [gmailResult, calendarResult] = await Promise.all([
    pollGmailIngestion({
      accessToken,
      cursor,
      now,
      watchKeywords,
    }),
    pollGoogleCalendarIngestion({
      accessToken,
      cursor,
      now,
      watchKeywords,
    }),
  ]);

  const signals = [...gmailResult.signals, ...calendarResult.signals];
  await persistSignals(signals, now);
  const dashboard = await getDashboardData();

  return {
    cursor: now.toISOString(),
    queuedCount: signals.length,
    needsYou: dashboard.needsYou,
  };
}
