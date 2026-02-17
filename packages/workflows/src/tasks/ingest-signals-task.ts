import { getDashboardData } from "@nyte/application/dashboard";
import { persistSignals } from "@nyte/application/queue";
import { pollGoogleCalendarIngestion } from "@nyte/integrations/calendar/polling";
import { pollGmailIngestion } from "@nyte/integrations/gmail/polling";

type GmailPollingInput = Parameters<typeof pollGmailIngestion>[0];
type DashboardNeedsYou = Awaited<
  ReturnType<typeof getDashboardData>
>["needsYou"];

export type IngestSignalsTaskInput = {
  accessToken: GmailPollingInput["accessToken"];
  cursor?: GmailPollingInput["cursor"];
  watchKeywords?: GmailPollingInput["watchKeywords"];
  now?: GmailPollingInput["now"];
};

export type IngestSignalsTaskResult = {
  cursor: string;
  queuedCount: number;
  needsYou: DashboardNeedsYou;
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
