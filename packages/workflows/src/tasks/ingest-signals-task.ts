import { getDashboardData } from "@nyte/application/dashboard/data";
import { persistSignals } from "@nyte/application/queue/persist-signals";
import { pollGoogleCalendarIngestion } from "@nyte/integrations/calendar/polling";
import { pollGmailIngestion } from "@nyte/integrations/gmail/polling";

type GmailPollingInput = Parameters<typeof pollGmailIngestion>[0];
type DashboardApprovalQueue = Awaited<
  ReturnType<typeof getDashboardData>
>["approvalQueue"];

type QueueCursorEnvelope = {
  version: 1;
  gmail?: string;
  calendar?: string;
};

export type IngestSignalsTaskInput = {
  accessToken: GmailPollingInput["accessToken"];
  cursor?: GmailPollingInput["cursor"];
  watchKeywords?: GmailPollingInput["watchKeywords"];
  now?: GmailPollingInput["now"];
};

export type IngestSignalsTaskResult = {
  cursor: string;
  queuedCount: number;
  approvalQueue: DashboardApprovalQueue;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseQueueCursor(cursor: string | undefined): {
  gmailCursor: string | undefined;
  calendarCursor: string | undefined;
} {
  if (!cursor) {
    return {
      gmailCursor: undefined,
      calendarCursor: undefined,
    };
  }

  const normalized = cursor.trim();
  if (!normalized) {
    return {
      gmailCursor: undefined,
      calendarCursor: undefined,
    };
  }

  try {
    const parsed = asRecord(JSON.parse(normalized));
    if (!parsed) {
      return {
        gmailCursor: normalized,
        calendarCursor: normalized,
      };
    }

    const version = parsed.version;
    if (version !== 1) {
      return {
        gmailCursor: normalized,
        calendarCursor: normalized,
      };
    }

    return {
      gmailCursor:
        typeof parsed.gmail === "string" && parsed.gmail.trim().length > 0
          ? parsed.gmail
          : undefined,
      calendarCursor:
        typeof parsed.calendar === "string" && parsed.calendar.trim().length > 0
          ? parsed.calendar
          : undefined,
    };
  } catch {
    return {
      gmailCursor: normalized,
      calendarCursor: normalized,
    };
  }
}

function serializeQueueCursor({
  gmailCursor,
  calendarCursor,
}: {
  gmailCursor: string | undefined;
  calendarCursor: string | undefined;
}): string {
  const envelope: QueueCursorEnvelope = {
    version: 1,
  };

  if (gmailCursor) {
    envelope.gmail = gmailCursor;
  }

  if (calendarCursor) {
    envelope.calendar = calendarCursor;
  }

  return JSON.stringify(envelope);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown ingestion error";
}

export async function ingestSignalsTask({
  accessToken,
  cursor,
  watchKeywords = [],
  now = new Date(),
}: IngestSignalsTaskInput): Promise<IngestSignalsTaskResult> {
  const { gmailCursor, calendarCursor } = parseQueueCursor(cursor);

  const [gmailResult, calendarResult] = await Promise.allSettled([
    pollGmailIngestion({
      accessToken,
      cursor: gmailCursor,
      now,
      watchKeywords,
    }),
    pollGoogleCalendarIngestion({
      accessToken,
      cursor: calendarCursor,
      now,
      watchKeywords,
    }),
  ]);

  if (
    gmailResult.status === "rejected" &&
    calendarResult.status === "rejected"
  ) {
    throw new Error(
      `Signal ingestion failed for Gmail and Calendar. Gmail: ${getErrorMessage(gmailResult.reason)}. Calendar: ${getErrorMessage(calendarResult.reason)}.`
    );
  }

  const signals = [
    ...(gmailResult.status === "fulfilled" ? gmailResult.value.signals : []),
    ...(calendarResult.status === "fulfilled"
      ? calendarResult.value.signals
      : []),
  ];

  const nextCursor = serializeQueueCursor({
    gmailCursor:
      gmailResult.status === "fulfilled"
        ? gmailResult.value.nextCursor
        : gmailCursor,
    calendarCursor:
      calendarResult.status === "fulfilled"
        ? calendarResult.value.nextCursor
        : calendarCursor,
  });

  await persistSignals(signals, now);
  const dashboard = await getDashboardData();

  return {
    cursor: nextCursor,
    queuedCount: signals.length,
    approvalQueue: dashboard.approvalQueue,
  };
}
