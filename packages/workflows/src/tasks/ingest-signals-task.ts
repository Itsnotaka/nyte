import { getDashboardData } from "@nyte/application/dashboard/data";
import { requireUserId } from "@nyte/application/identity/user-id";
import {
  getUserIngestionState,
  upsertUserIngestionState,
} from "@nyte/application/queue/ingestion-state";
import { persistSignals } from "@nyte/application/queue/persist-signals";
import { ingestGoogleCalendarSignals } from "@nyte/integrations/calendar/ingestion";
import { ingestGmailSignals } from "@nyte/integrations/gmail/ingestion";

type GmailIngestionInput = Parameters<typeof ingestGmailSignals>[0];
type DashboardApprovalQueue = Awaited<
  ReturnType<typeof getDashboardData>
>["approvalQueue"];
const DEFAULT_STALE_AFTER_MS = 2 * 60 * 1000;

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
  staleAfterMs?: number;
  force?: boolean;
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

function parseStateDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isStale({
  now,
  lastSyncedAt,
  staleAfterMs,
}: {
  now: Date;
  lastSyncedAt: Date | null;
  staleAfterMs: number;
}) {
  if (!lastSyncedAt) {
    return true;
  }

  return now.getTime() - lastSyncedAt.getTime() >= staleAfterMs;
}

export async function ingestSignalsTask({
  userId,
  accessToken,
  cursor,
  watchKeywords = [],
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  force = false,
  now = new Date(),
}: IngestSignalsTaskInput): Promise<IngestSignalsTaskResult> {
  const normalizedUserId = requireUserId(userId);
  const storedState = await getUserIngestionState(normalizedUserId);
  const fallbackCursor = parseQueueCursor(cursor);
  const gmailCursor =
    storedState?.gmailCursor ?? fallbackCursor.gmailCursor ?? undefined;
  const calendarCursor =
    storedState?.calendarCursor ?? fallbackCursor.calendarCursor ?? undefined;
  const lastSyncedAt = parseStateDate(storedState?.lastSyncedAt ?? null);

  if (
    !force &&
    storedState?.bootstrapCompletedAt &&
    !isStale({
      now,
      lastSyncedAt,
      staleAfterMs,
    })
  ) {
    const dashboard = await getDashboardData(normalizedUserId, {
      importantOnly: false,
      includeSecondary: false,
    });

    return {
      cursor: serializeQueueCursor({
        gmailCursor,
        calendarCursor,
      }),
      queuedCount: 0,
      approvalQueue: dashboard.approvalQueue,
    } satisfies IngestSignalsTaskResult;
  }

  const [gmailResult, calendarResult] = await Promise.allSettled([
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
  ]);

  if (
    gmailResult.status === "rejected" &&
    calendarResult.status === "rejected"
  ) {
    await upsertUserIngestionState({
      userId: normalizedUserId,
      gmailCursor: storedState?.gmailCursor ?? gmailCursor ?? null,
      calendarCursor: storedState?.calendarCursor ?? calendarCursor ?? null,
      lastSyncedAt,
      bootstrapCompletedAt: parseStateDate(
        storedState?.bootstrapCompletedAt ?? null
      ),
      lastError: `gmail:${getErrorMessage(gmailResult.reason)} | calendar:${getErrorMessage(calendarResult.reason)}`,
      now,
    });

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

  await persistSignals(signals, normalizedUserId, now);
  await upsertUserIngestionState({
    userId: normalizedUserId,
    gmailCursor:
      gmailResult.status === "fulfilled"
        ? gmailResult.value.nextCursor
        : (gmailCursor ?? null),
    calendarCursor:
      calendarResult.status === "fulfilled"
        ? calendarResult.value.nextCursor
        : (calendarCursor ?? null),
    lastSyncedAt: now,
    bootstrapCompletedAt:
      parseStateDate(storedState?.bootstrapCompletedAt ?? null) ?? now,
    lastError: null,
    now,
  });
  const dashboard = await getDashboardData(normalizedUserId, {
    importantOnly: false,
    includeSecondary: false,
  });

  return {
    cursor: nextCursor,
    queuedCount: signals.length,
    approvalQueue: dashboard.approvalQueue,
  } satisfies IngestSignalsTaskResult;
}
