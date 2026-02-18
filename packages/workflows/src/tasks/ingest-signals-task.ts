import { getDashboardData } from "@nyte/application/dashboard/data";
import { persistSignals } from "@nyte/application/queue/persist-signals";
import { ingestGoogleCalendarSignals } from "@nyte/integrations/calendar/ingestion";
import { ingestGmailSignals } from "@nyte/integrations/gmail/ingestion";
import { Effect } from "effect";

import { runWorkflowEffect } from "../effect-runtime";

type GmailIngestionInput = Parameters<typeof ingestGmailSignals>[0];
type DashboardApprovalQueue = Awaited<
  ReturnType<typeof getDashboardData>
>["approvalQueue"];

type QueueCursorEnvelope = {
  version: 1;
  gmail?: string;
  calendar?: string;
};

export type IngestSignalsTaskInput = {
  userId: string;
  accessToken: GmailIngestionInput["accessToken"];
  cursor?: GmailIngestionInput["cursor"];
  watchKeywords?: GmailIngestionInput["watchKeywords"];
  now?: GmailIngestionInput["now"];
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

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return "Unknown ingestion error";
}

export function ingestSignalsTaskProgram({
  userId,
  accessToken,
  cursor,
  watchKeywords = [],
  now = new Date(),
}: IngestSignalsTaskInput) {
  return Effect.gen(function* () {
    const { gmailCursor, calendarCursor } = parseQueueCursor(cursor);

    const [gmailResult, calendarResult] = yield* Effect.tryPromise(() =>
      Promise.allSettled([
        ingestGmailSignals({
          accessToken,
          cursor: gmailCursor,
          now,
          watchKeywords,
        }),
        ingestGoogleCalendarSignals({
          accessToken,
          cursor: calendarCursor,
          now,
          watchKeywords,
        }),
      ])
    );

    if (
      gmailResult.status === "rejected" &&
      calendarResult.status === "rejected"
    ) {
      return yield* Effect.fail(
        new Error(
          `Signal ingestion failed for Gmail and Calendar. Gmail: ${getErrorMessage(gmailResult.reason)}. Calendar: ${getErrorMessage(calendarResult.reason)}.`
        )
      );
    }

    const signals = [
      ...(gmailResult.status === "fulfilled"
        ? gmailResult.value.signals
        : []),
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

    yield* Effect.tryPromise(() => persistSignals(signals, userId, now));
    const dashboard = yield* Effect.tryPromise(() => getDashboardData());

    return {
      cursor: nextCursor,
      queuedCount: signals.length,
      approvalQueue: dashboard.approvalQueue,
    } satisfies IngestSignalsTaskResult;
  });
}

export async function ingestSignalsTask(
  input: IngestSignalsTaskInput
): Promise<IngestSignalsTaskResult> {
  return runWorkflowEffect(ingestSignalsTaskProgram(input));
}
